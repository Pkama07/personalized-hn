from datetime import datetime, timezone
import logging
from pinecone import Pinecone
import requests
from scrapegraphai.graphs import SmartScraperGraph


pc_client = Pinecone(api_key="pcsk_f1csj_LVQzqXehHT98TeNLPKXLctw4TqWAky1GYb5C69Cok1HSRkeLnrSdLeH9Cwyx985")


def safe_get(url, field):
    try:
        return {"success": True, field: requests.get(url).json()}
    except Exception as e:
        return {"success": False, "error": str(e)}


NEW_STORIES_URL = "https://hacker-news.firebaseio.com/v0/newstories.json?print=pretty"
def fetch_new_items():
    return safe_get(NEW_STORIES_URL, "items")


def fetch_item_details(item):
    ITEM_URL = f"https://hacker-news.firebaseio.com/v0/item/{item}.json?print=pretty"
    return safe_get(ITEM_URL, "details")


graph_config = {
   "llm": {
      "model": "ollama/llama3.2",
      "temperature": 0,
      "format": "json",
      "model_tokens": 8192,
      "base_url": "http://localhost:11434",
   },
   "headless": True,
}
def generate_description(url):
    print("processing", url)
    try:
        smart_scraper_graph = SmartScraperGraph(
            prompt="Please summarize the content of this page. Put this summary under a field called 'summary'. Also, who would be interested in the content on this page? Put a comma separated answer under a field called 'target'. If there is an error getting the info, set a field called 'error' to true.",
            source=url,
            config=graph_config
        )
        result = smart_scraper_graph.run()
    except Exception as e:
        return None
    if result.get("error", False):
        return None
    target = result.get("target", "")
    if isinstance(target, list):
        target = ", ".join(target) + "."
    summary = result.get("summary", "")
    if summary == "":
        summary = result.get("description", "")
    return summary + (f" {target}" if not target == "" else "")


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
            "metadata": {"url": d["url"], "time": d["time"], "score": d["score"], "last_update": d["last_update"]}
        })
    pc_client.Index("news-index").upsert(
        vectors=records,
        namespace="news"
    )


def process_new_articles():
    item_response = fetch_new_items()
    if not item_response["success"]:
        logging.error("Failed to fetch new items.")
        logging.error(item_response["error"])
        exit()
    items = item_response["items"]
    with open("latest.txt", "r") as f:
        latest_prev_time = int(f.read())
    new_latest_time = latest_prev_time
    has_updated_time = False
    data = []
    for item in items:
        try:
            item_details_response = fetch_item_details(item)
            if not item_details_response["success"]:
                logging.warning(f"Failed to fetch info on {item}")
                logging.warning(item_details_response["error"])
                continue
            details = item_details_response["details"]
            time_of_publish = details.get("time", latest_prev_time + 1)
            if time_of_publish <= latest_prev_time:
                break
            if not has_updated_time:
                new_latest_time = time_of_publish
                has_updated_time = True
            title = details.get("title", "")
            id = details["id"]
            url = details.get("url", None)
            score = details.get("score", 0)
            description = generate_description(url) if url is not None else details.get("text", None)
            if description is None:
                description = ""
            passage = title + (f". {description}" if not description == "" else "")
            data.append({
                "id": str(id),
                "passage": passage,
                "time": time_of_publish,
                "url": url if url is not None else f"https://news.ycombinator.com/item?id={id}",
                "score": score,
                "last_update": int(datetime.now(timezone.utc).timestamp())
            })
        except Exception as e:
            logging.warning(f"Failed to generate data for {item}")
            logging.warning(str(e))
            continue
    print(data)
    try:
        write_to_pinecone(data)
    except Exception as e:
        logging.error("Failed to write new articles to the database.")
        logging.error(str(e))
        return
    with open("latest.txt", "w") as f:
        f.write(str(new_latest_time))


if __name__ == "__main__":
    process_new_articles()

