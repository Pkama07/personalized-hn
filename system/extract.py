import base64
from datetime import datetime, timezone
from dotenv import load_dotenv
import logging
import os
from pinecone import Pinecone
from playwright.sync_api import sync_playwright
from playwright_stealth import stealth_sync
import requests

load_dotenv()
pc_client = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
logging.basicConfig(level=logging.INFO)
MODEL_URL = "http://localhost:11434/api/generate"

def scrape_content(url):
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")
        page = context.new_page()
        stealth_sync(page)
        page.goto(url)
        try:
            page.wait_for_load_state('domcontentloaded', timeout=3000)
            page.wait_for_load_state('networkidle', timeout=3000)
        except Exception:
            pass
        main_content = page.evaluate('''
            () => {
                const elementsToRemove = document.querySelectorAll('nav, footer, script, style');
                elementsToRemove.forEach(el => el.remove());
                return document.body.innerText;
            }
        ''')
        paragraph_content = "\n".join([p.text_content() for p in page.locator('p').all()])
        page.screenshot(path="page.png", full_page=True)
        return f"Main content:\n{main_content}\n\nParagraph content:\n{paragraph_content}"

def condense(summary):
    condense_prompt = f"The below text is a summary extracted from a website. Please analyze it and create a 1-2 sentence breakdown of the key topics unless it seems like the extraction failed and the text describes an error message or captcha; in this case, output the text 'PARSING FAILED'. Include nothing but the breakdown in your response. Here is the text:\n\n{summary}"
    condense_payload = {
        "model": "llama3.2",
        "prompt": condense_prompt,
        "stream": False
    }
    return requests.post(MODEL_URL, json=condense_payload).json()

def generate_summary(text_input):
    summarize_prompt = f"""
        Please generate a breakdown of the key topics on a website. Below is the main text content of a website (under 'Main content:') and the text content in each paragraph (under 'Paragraph content:'). There may be some repeat text between these, but there may also be little to no information in these if parsing was unsuccessful. I have also provided a screenshot of the page itself. It is also possible that some extraneous information is present; for instance, there could be advertisements or secondary articles, so try to focus on the primary content which will likely appear first.\n\n{text_input}
    """
    with open("page.png", "rb") as img_file:
        img_base64 = base64.b64encode(img_file.read()).decode('utf-8')
    summary_payload = {
        "model": "llava",
        "prompt": summarize_prompt,
        "stream": False,
        "images": [img_base64]
    }
    response = requests.post(MODEL_URL, json=summary_payload).json()
    return response["response"]

def summarize(url):
    logging.info(f"Summarizing {url}")
    logging.info("scraping the content...")
    text_input = scrape_content(url)
    logging.info("generating the summary...")
    summary = generate_summary(text_input)
    logging.info("condensing the summary...")
    return condense(summary).get("response", "")

def safe_get(url, field):
    try:
        return {"success": True, field: requests.get(url).json()}
    except Exception as e:
        return {"success": False, "error": str(e)}

TOP_STORIES_URL = "https://hacker-news.firebaseio.com/v0/topstories.json?print=pretty"
def fetch_top_stories():
    return safe_get(TOP_STORIES_URL, "items")

def fetch_item_details(item):
    ITEM_URL = f"https://hacker-news.firebaseio.com/v0/item/{item}.json?print=pretty"
    return safe_get(ITEM_URL, "details")

def write_to_pinecone(data):
    embeddings = pc_client.inference.embed(
        model="multilingual-e5-large",
        inputs=[d["passage"] for d in data],
        parameters={"input_type": "passage", "truncate": "END"}
    )
    records = []
    for d, e in zip(data, embeddings):
        records.append({
            "id": d["id"],
            "values": e["values"],
            "metadata": {"url": d["url"], "time_added": d["time_added"], "passage": d["passage"]}
        })
    pc_client.Index("news").upsert(
        vectors=records,
        namespace="items"
    )

def process_top_articles():
    item_response = fetch_top_stories()
    if not item_response["success"]:
        logging.error("Failed to fetch new items.")
        logging.error(item_response["error"])
        exit()
    STORY_COUNT = 5
    top_ids = [str(id) for id in item_response["items"][:STORY_COUNT]]
    logging.info("Fetching existing vectors")
    existing_vectors = pc_client.Index("news").fetch(
        ids=top_ids,
        namespace="items",
    ).get("vectors", None)
    if existing_vectors is None:
        logging.error("Unable to fetch existing vectors from the db.")
        return
    data = []
    for id in top_ids:
        if existing_vectors.get(id, None) is not None:
            logging.info(f"{id} has already been ingested")
            continue
        try:
            logging.info(f"Processing {id}")
            item_details_response = fetch_item_details(id)
            if not item_details_response["success"]:
                logging.warning(f"Failed to fetch info on {id}")
                logging.warning(item_details_response["error"])
                continue
            details = item_details_response["details"]
            title = details.get("title", "")
            id = details["id"] # if there's no id, throw an error
            url = details.get("url", "")
            description = summarize(url) if not url == "" else details.get("text", "")
            passage = title + (f". {description}" if not description == "" else "")
            data.append({
                "id": str(id),
                "passage": passage,
                "url": url,
                "time_added": int(datetime.now(timezone.utc).timestamp())
            })
        except Exception as e:
            logging.warning(f"Failed to generate data for {id}")
            logging.warning(str(e))
            continue
    try:
        if len(data) > 0:
            write_to_pinecone(data)
    except Exception as e:
        logging.error("Failed to write new articles to the database.")
        logging.error(str(e))

if __name__ == "__main__":
    process_top_articles()