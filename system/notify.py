from datetime import datetime, timezone
from dotenv import load_dotenv
from jinja2 import Template
import logging
import os
from pinecone import Pinecone
import re
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Email
import schedule
import time
from supabase import create_client
from datetime import datetime, timedelta

logging.basicConfig(level=logging.INFO)
load_dotenv()
pc_client = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
sb_client = create_client(
    os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_ROLE_KEY")
)
news_index = pc_client.Index("news")


def fetch_outdated_users():
    DAY_SECONDS = 86400
    WEEK_SECONDS = 604800
    current_timestamp = int(datetime.now(timezone.utc).timestamp())
    day_threshold = current_timestamp - DAY_SECONDS
    with open("dummy_vector.txt", "r") as f:
        dummy_vector = eval(f.read())
    outdated_daily_users = news_index.query(
        filter={"last_updated": {"$lte": day_threshold}, "type": "daily"},
        vector=dummy_vector,
        top_k=100,
        namespace="users",
        include_metadata=True,
        include_values=True,
    )
    week_threshold = current_timestamp - WEEK_SECONDS
    outdated_weekly_users = news_index.query(
        filter={"last_updated": {"$lte": week_threshold}, "type": "weekly"},
        vector=dummy_vector,
        top_k=100,
        namespace="users",
        include_metadata=True,
        include_values=True,
    )
    return outdated_daily_users["matches"] + outdated_weekly_users["matches"]


def generate_info(outdated_users):
    user_items = {}
    for ou in outdated_users:
        user_vector = ou["values"]
        user_metadata = ou["metadata"]
        recent_items = [
            str(item["item_id"])
            for item in (
                sb_client.table("profile_items")
                .select("item_id")
                .eq("profile_id", ou["id"])
                .gte("created_at", (datetime.now() - timedelta(days=10)).isoformat())
                .execute()
            ).data
        ]
        best_articles = news_index.query(
            top_k=100,
            vector=user_vector,
            namespace="items",
            include_values=False,
            include_metadata=True,
        )
        matches = best_articles["matches"]
        items = []
        for match in matches:
            if match["id"] in recent_items:
                continue
            match_metadata = match["metadata"]
            items.append(
                {
                    "id": match["id"],
                    "hn_url": f"https://news.ycombinator.com/item?id={match['id']}",
                    "internal_url": f"https://hackernyousletter.com/redirect?item_id={match['id']}",
                    "title": match_metadata.get("title", "Item Title"),
                    "description": match_metadata["passage"].removeprefix(
                        match_metadata.get("title", "") + ". "
                    ),
                }
            )
            if len(items) >= user_metadata["count"]:
                break
        user_items[(user_metadata["email"], ou["id"])] = items
    return user_items


def send_mail(recipient, html):
    message = Mail(
        from_email=Email(f"mailman@pradyun.dev", "Hacker Nyousletter"),
        to_emails=recipient,
        subject="Personalized Hacker News Feed",
        html_content=html,
    )
    try:
        sg = SendGridAPIClient(os.getenv("SENDGRID_API_KEY"))
        response = sg.send(message)
        logging.info(f"Messaged {recipient} with status code {response.status_code}")
    except Exception as e:
        logging.error(e.message)


def send_newsletters(mailing_info):
    with open("template.html", "r") as file:
        template_content = file.read()
    jinja_template = Template(template_content)
    curr_time = int(datetime.now(timezone.utc).timestamp())
    for k, items in mailing_info.items():
        rendered_html = jinja_template.render(items=items)
        send_mail(k[0], rendered_html)
        news_index.update(
            id=k[1], set_metadata={"last_updated": curr_time}, namespace="users"
        )
        try:
            sb_client.table("profile_items").insert(
                [{"profile_id": k[1], "item_id": item["id"]} for item in items]
            ).execute()
        except Exception as e:
            logging.warning(f"Failed to insert profile_item record: {str(e)}")


def mail_outdated_users():
    logging.info("fetching outdated users...")
    outdated_users = fetch_outdated_users()
    logging.info("grabbing relevant articles...")
    mailing_info = generate_info(outdated_users)
    logging.info("sending the newsletters...")
    send_newsletters(mailing_info)


if __name__ == "__main__":
    # schedule.every(30).minutes.do(mail_outdated_users)
    # while True:
    #     schedule.run_pending()
    #     time.sleep(1)
    mail_outdated_users()
