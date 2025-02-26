import base64
from dotenv import load_dotenv
import logging
import os
from pinecone import Pinecone
from playwright.sync_api import sync_playwright
from playwright_stealth import stealth_sync
import requests
import PIL
from PIL import Image
import json
import boto3
from botocore.exceptions import ClientError
import time
from supabase import create_client
from datetime import datetime, timedelta
import schedule
import re

load_dotenv()
pc_client = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
sb_client = create_client(
    os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_ROLE_KEY")
)
bedrock = boto3.client("bedrock")
s3_client = boto3.client("s3")
logging.basicConfig(level=logging.INFO)
TOP_STORIES_URL = "https://hacker-news.firebaseio.com/v0/topstories.json?print=pretty"
OUTPUT_BUCKET = os.getenv("OUTPUT_BUCKET")
INPUT_BUCKET = os.getenv("INPUT_BUCKET")


def optimize_image(image_path):
    MAX_WIDTH = 400
    img = Image.open(image_path)
    if img.mode != "L":
        img = img.convert("L")
    width_percent = MAX_WIDTH / float(img.size[0])
    new_height = int((float(img.size[1]) * float(width_percent)))
    if img.size[0] > MAX_WIDTH:
        img = img.resize((MAX_WIDTH, new_height), PIL.Image.Resampling.LANCZOS)
    img.save(
        image_path.replace(".png", ".jpg"),
        "JPEG",
        optimize=True,
        quality=85,
        progressive=True,
    )


def scrape_content(url):
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
        )
        page = context.new_page()
        stealth_sync(page)
        page.goto(url)
        try:
            page.wait_for_load_state("domcontentloaded", timeout=5000)
            page.wait_for_load_state("networkidle", timeout=5000)
        except Exception:
            pass
        page.screenshot(path="page.png")
        paragraph_content = "\n".join(
            [p.text_content() for p in page.locator("p").all()]
        )
        optimize_image("page.png")
        return f"Paragraph content:\n{paragraph_content[:1000]}"


def generate_topics(text_input):
    prompt = f"""
        Generate a concise 1-3 sentence description of this website. Below is the text content in each paragraph (under 'Paragraph content:'). There may be little to no information in this if parsing was unsuccessful. I have also provided a screenshot of the page itself, but if it appears to display an error message do not let this error message influence the description. It is possible that some extraneous information is present; for instance, there could be advertisements or secondary articles, so try to focus on the primary content which will likely appear first or in the center.\n\n{text_input}
    """
    with open("page.png", "rb") as img_file:
        img_base64 = base64.b64encode(img_file.read()).decode("utf-8")
    body = json.dumps(
        {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 100,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": "image/jpeg",
                                "data": img_base64,
                            },
                        },
                        {"type": "text", "text": prompt},
                    ],
                }
            ],
        }
    )
    max_retries = 8
    for attempt in range(max_retries):
        try:
            response = bedrock.invoke_model(
                modelId="anthropic.claude-3-sonnet-20240229-v1:0",
                body=body,
            )
            response_body = json.loads(response.get("body").read())
            text = response_body["content"][0]["text"]
            return text.split(":", 1)[1].strip() if ":" in text else text

        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code", "")

            if error_code in [
                "ThrottlingException",
                "TooManyRequestsException",
                "RequestLimitExceeded",
            ]:
                if attempt == max_retries - 1:
                    logging.warning(f"Max retries reached after {max_retries} attempts")
                    raise

                delay = 2**attempt
                logging.info(
                    f"Rate limited. Retrying in {delay:.2f} seconds... (Attempt {attempt + 1}/{max_retries})"
                )
                time.sleep(delay)
                continue
            else:
                raise


def summarize(url):
    logging.info(f"Summarizing {url}")
    logging.info("scraping the content...")
    text_input = scrape_content(url)
    logging.info("generating the summary...")
    return generate_topics(text_input)


def safe_get(url, field):
    try:
        return {"success": True, field: requests.get(url).json()}
    except Exception as e:
        return {"success": False, "error": str(e)}


def generate_item_url(item_id):
    return f"https://hacker-news.firebaseio.com/v0/item/{item_id}.json?print=pretty"


def write_to_pinecone(data):
    start_index = 0
    end_index = 96
    embeddings = []
    while start_index < len(data):
        embeddings.extend(
            pc_client.inference.embed(
                model="multilingual-e5-large",
                inputs=[d["passage"] for d in data[start_index:end_index]],
                parameters={"input_type": "passage", "truncate": "END"},
            )
        )
        start_index += 96
        end_index += 96
    records = []
    for d, e in zip(data, embeddings):
        records.append(
            {
                "id": d["id"],
                "values": e["values"],
                "metadata": {
                    "url": d["url"],
                    "time_added": d["time_added"],
                    "passage": d["passage"],
                },
            }
        )
    pc_client.Index("news").upsert(vectors=records, namespace="items")


def ingest_new_items():
    item_response = safe_get(TOP_STORIES_URL, "items")
    if not item_response["success"]:
        logging.error("Failed to fetch new items.")
        logging.error(item_response["error"])
        exit()
    STORY_COUNT = 100
    top_ids = [str(id) for id in item_response["items"][:STORY_COUNT]]
    logging.info("Fetching existing vectors")
    recent_ids = [
        str(item["id"])
        for item in (
            sb_client.table("items")
            .select("id")
            .gte("created_at", (datetime.now() - timedelta(days=5)).isoformat())
            .execute()
        ).data
    ]
    json_data = []
    items = []
    for id in top_ids:
        if id in recent_ids:
            logging.info(f"{id} has already been ingested in the past 5 days")
            continue
        try:
            logging.info(f"Processing {id}")
            hn_url = generate_item_url(id)
            item_details_response = safe_get(hn_url, "details")
            if not item_details_response["success"]:
                logging.warning(f"Failed to fetch info on {id}")
                logging.warning(item_details_response["error"])
                continue
            details = item_details_response["details"]
            id = details["id"]
            url = details.get("url", "")
            items.append(
                {
                    "id": id,
                    "url": hn_url if url == "" else url,
                }
            )
            should_scrape = url != ""
            text_input = (
                scrape_content(url) if should_scrape else details.get("text", "")
            )
            content_list = [
                {
                    "type": "text",
                    "text": f"""Generate a concise comma-separated list of key topics of a website given the following info. Only output this list; nothing else. Do not add any text like "here is the list" or anything similar. Below is the main text content of the website (under 'Main content:') and the text content in each paragraph (under 'Paragraph content:'). There may be little to no information in these if parsing was unsuccessful. I have also provided a screenshot of the page itself prior to any vertical scrolling It is possible that some extraneous information is present; for instance, there could be advertisements or secondary articles, so try to focus on the primary content which will likely appear first or in the center.\n\n{text_input}""",
                }
            ]
            if should_scrape:
                image_content = open("page.jpg", "rb").read()
                base64_image = base64.b64encode(image_content).decode("utf-8")
                content_list.append(
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/jpeg",
                            "data": base64_image,
                        },
                    }
                )
            json_data.append(
                {
                    "recordID": id,
                    "modelInput": {
                        "recordID": id,
                        "anthropic_version": "bedrock-2023-05-31",
                        "max_tokens": 100,
                        "messages": [
                            {
                                "role": "user",
                                "content": content_list,
                            }
                        ],
                    },
                }
            )
        except Exception as e:
            logging.warning(f"Failed to generate data for {id}")
            logging.warning(str(e))
            continue
    if items:
        try:
            sb_client.table("items").upsert(items).execute()
            logging.info(f"Successfully wrote {len(items)} items to Supabase")
        except Exception as e:
            logging.error("Failed to write items to Supabase")
            logging.error(str(e))
    try:
        should_upload = False
        with open(f"input.jsonl", "a+", encoding="utf-8") as f:
            for item in json_data:
                json_line = json.dumps(item, ensure_ascii=False)
                f.write(json_line + "\n")
            f.seek(0)
            should_upload = len(f.readlines()) >= 100
        trash = ["page.png", "page.jpg"]
        if should_upload:
            curr_time = int(time.time())
            s3_client.upload_file(
                f"input.jsonl",
                INPUT_BUCKET,
                f"input-{curr_time}.jsonl",
            )
            bedrock.create_model_invocation_job(
                modelId="anthropic.claude-3-sonnet-20240229-v1:0",
                jobName=f"batch-inference-{curr_time}",
                inputDataConfig={
                    "s3InputDataConfig": {
                        "s3Uri": f"s3://{INPUT_BUCKET}/input-{curr_time}.jsonl",
                        "s3InputFormat": "JSONL",
                        "s3BucketOwner": "165159921038",
                    }
                },
                outputDataConfig={
                    "s3OutputDataConfig": {"s3Uri": f"s3://{OUTPUT_BUCKET}/"}
                },
                roleArn="arn:aws:iam::165159921038:role/AWSBedrockBatchInferenceRole",
            )
            trash.append("input.jsonl")
        for file in trash:
            if os.path.exists(file):
                os.remove(file)
    except Exception as e:
        logging.error("Failed to create inference job")
        logging.error(str(e))


def get_s3_file(bucket, key):
    response = s3_client.get_object(Bucket=bucket, Key=key)
    return response["Body"].read().decode("utf-8")


def check_batch_inference_output():
    try:
        paginator = s3_client.get_paginator("list_objects_v2")
        pages = paginator.paginate(Bucket=OUTPUT_BUCKET)
        output_contents = {}
        count = 0
        for page in pages:
            if "Contents" not in page:
                continue
            for obj in page["Contents"]:
                key = obj["Key"]
                match = re.match(r"input-(\d+)\.jsonl", key)
                if not match:
                    continue
                timestamp = match.group(1)
                input_content = get_s3_file(INPUT_BUCKET, f"input-{timestamp}.jsonl")
                record_ids = [
                    json.loads(line)["recordID"]
                    for line in input_content.split("\n")
                    if line
                ]
                response = get_s3_file(OUTPUT_BUCKET, key)
                for line in response.split("\n"):
                    if line:
                        try:
                            json_line = json.loads(line)
                            record_id = record_ids[count]
                            model_output = json_line["modelOutput"]["content"][0][
                                "text"
                            ]
                            output_contents[record_id] = model_output
                        except Exception as e:
                            logging.warning(f"Failed to parse line: {line}")
                            logging.warning(str(e))
                    count += 1
        return output_contents
    except Exception as e:
        logging.error("Failed to check batch inference output")
        logging.error(str(e))
        return {}


def process_model_output(model_output):
    items_to_write = []
    for item_id, output in model_output.items():
        item_response = safe_get(generate_item_url(item_id), "details")
        if not item_response["success"]:
            logging.warning(f"Could not fetch JSON for item {item_id}")
            continue
        details = item_response["details"]
        passage = details.get("title", "") + ". " + output
        try:
            sb_client.table("items").update({"passage": passage}).eq(
                "id", item_id
            ).execute()
        except Exception as e:
            logging.warning(f"Failed to update Supabase for item {item_id}: {str(e)}")
            continue
        items_to_write.append(
            {
                "id": str(item_id),
                "url": details.get("url", ""),
                "passage": passage,
                "time_added": int(time.time()),
            }
        )
    if items_to_write:
        write_to_pinecone(items_to_write)
    else:
        logging.warning("No valid items found to write to Pinecone")


def remove_old_vectors():
    logging.info("Removing old vectors from Pinecone")
    try:
        DAYS_TO_KEEP = 10
        cutoff_time = int(time.time()) - (DAYS_TO_KEEP * 24 * 60 * 60)
        old_vectors = pc_client.Index("news").query(
            namespace="items",
            filter={"time_added": {"$lt": cutoff_time}},
            top_k=10000,
            include_metadata=False,
        )
        if not old_vectors.matches:
            logging.info("No old vectors found to delete")
            return
        vector_ids = [match.id for match in old_vectors.matches]
        pc_client.Index("news").delete(ids=vector_ids, namespace="items")
        logging.info(f"Successfully removed {len(vector_ids)} old vectors")

    except Exception as e:
        logging.error("Failed to remove old vectors from Pinecone")
        logging.error(str(e))


def cleanup_s3_files():
    logging.info("Cleaning up old S3 files")
    try:
        DAYS_TO_KEEP = 0
        cutoff_time = datetime.now() - timedelta(days=DAYS_TO_KEEP)
        input_files = s3_client.list_objects_v2(Bucket=INPUT_BUCKET)
        if "Contents" not in input_files:
            logging.info("No files found in input bucket")
            return
        for obj in input_files["Contents"]:
            key = obj["Key"]
            match = re.match(r"input-(\d+)\.jsonl", key)
            if not match:
                continue
            timestamp = int(match.group(1))
            file_date = datetime.fromtimestamp(timestamp)
            if file_date < cutoff_time:
                s3_client.delete_object(Bucket=INPUT_BUCKET, Key=key)
                output_key = f"output-{timestamp}.jsonl"
                s3_client.delete_object(Bucket=OUTPUT_BUCKET, Key=output_key)
                logging.info(f"Deleted old files with timestamp {timestamp}")
        logging.info("Successfully cleaned up old S3 files")

    except Exception as e:
        logging.error("Failed to clean up old S3 files")
        logging.error(str(e))


if __name__ == "__main__":
    # schedule.every(30).minutes.do(ingest_new_items)
    # schedule.every(30).minutes.do(remove_old_vectors)
    # # schedule.every(30).minutes.do(write_vectors)

    # while True:
    #     schedule.run_pending()
    #     time.sleep(1)
    # process_model_output(check_batch_inference_output())
    cleanup_s3_files()
    # print(check_batch_inference_output())
