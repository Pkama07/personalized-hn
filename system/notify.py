from datetime import datetime, timezone
from dotenv import load_dotenv
from jinja2 import Template
import logging
import os
from pinecone import Pinecone
import requests
import re
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail

logging.basicConfig(level=logging.INFO)
load_dotenv()
pc_client = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
news_index = pc_client.Index("news")

DAY_SECONDS = 86400
WEEK_SECONDS = 604800
def fetch_outdated_users():
    current_timestamp = int(datetime.now(timezone.utc).timestamp())
    day_threshold = int(datetime.now(timezone.utc).timestamp()) - 86400
    with open('dummy_vector.txt', 'r') as f:
        dummy_vector = eval(f.read())
    outdated_daily_users = news_index.query(
        filter={
            "last_updated": {"$lte": day_threshold},
            "type": "daily"
        },
        vector=dummy_vector,
        top_k=10000,
        namespace="users",
        include_metadata=True,
        include_values=True
    )
    week_threshold = current_timestamp - WEEK_SECONDS
    outdated_weekly_users = news_index.query(
        filter={
            "last_updated": {"$lte": week_threshold},
            "type": "weekly"
        },
        vector=dummy_vector,
        top_k=10000,
        namespace="users",
        include_metadata=True,
        include_values=True
    )
    return outdated_daily_users["matches"] + outdated_weekly_users["matches"]

def generate_info(outdated_users):
    outdated_users = fetch_outdated_users()
    user_items = {}
    for ou in outdated_users:
        user_vector = ou["values"]
        user_metadata = ou["metadata"]
        last_updated = user_metadata["last_updated"]
        best_articles = news_index.query(
            top_k=user_metadata["count"],
            vector=user_vector,
            namespace="items",
            filter={
                "time_added": {"$gte": last_updated}
            },
            include_values=False,
            include_metadata=True
        )
        matches = best_articles["matches"]
        items = []
        for match in matches:
            item_data = {"hn_url": f"https://news.ycombinator.com/item?id={match['id']}"}
            match_metadata = match["metadata"]
            item_data["external_url"] = match_metadata["url"]
            passage = match_metadata["passage"]
            pos = re.search("\. ", passage)
            item_data["title"] = passage[:pos.start()]
            item_data["description"] = passage[pos.end():]
            items.append(item_data)
        user_items[(user_metadata["email"], ou["id"])] = items
    return user_items

def send_mail(recipient, html):
    message = Mail(
        from_email=f"mailman@pradyun.dev",
        to_emails=recipient,
        subject="Personalized Hacker News Feed",
        html_content=html
    )
    try:
        sg = SendGridAPIClient(os.getenv('SENDGRID_API_KEY'))
        response = sg.send(message)
        logging.info(f"Messaged {recipient} with status code {response.status_code}")
    except Exception as e:
        print(e.message)

def send_newsletters(mailing_info):
    with open('template.html', 'r') as file:
        template_content = file.read()
    jinja_template = Template(template_content)
    curr_time = int(datetime.now(timezone.utc).timestamp())
    for k, items in mailing_info.items():
        rendered_html = jinja_template.render(items=items)
        send_mail(k[0], rendered_html)
        news_index.update(
            id=k[1],
            set_metadata={"last_updated": curr_time},
            namespace="users"
        )

def mail_outdated_users():
    logging.info("fetching outdated users...")
    outdated_users = fetch_outdated_users()
    logging.info("grabbing relevant articles...")
    mailing_info = generate_info(outdated_users)
    logging.info("sending the newsletters...")
    send_newsletters(mailing_info)

if __name__ == "__main__":
    mail_outdated_users()