export default function Writeup() {
    return (
        <div className="min-h-screen flex flex-col items-center p-8 max-w-3xl mx-auto">
            <h1 className="text-4xl font-bold mb-8">
                How hackern<span className="text-primary">you</span>sletter was
                built
            </h1>

            <section className="space-y-8 w-full">
                <div className="space-y-4">
                    <p className="text-lg">
                        I built this project to learn about vector databases and
                        levaraging LLMs in a production context. I became
                        interested in this idea after signing up for the{" "}
                        <a
                            href="https://hackernewsletter.com/"
                            target="_blank"
                            className="underline text-primary"
                        >
                            existing Hacker Newsletter
                        </a>{" "}
                        and realizing that LLMs are perfect for summarizing
                        content and therefore could be used to programmatically
                        curate stories.
                    </p>
                </div>
                <div className="space-y-4">
                    <h2 className="text-2xl font-semibold">
                        The basic concept
                    </h2>
                    <p className="text-lg">
                        When a user specifies their interests on the frontend, a
                        vector representation of these interests is created
                        using Pinecone's "multilingual-e5-large" model and saved
                        to the database. There is also a job running on an EC2
                        instance which periodically fetches the top 100 stories
                        on Hacker News, scrapes and summarizes the content of
                        each, and saves them to the vector database in a similar
                        manner. When it's time to send the newsletter to a user,
                        a query is made to identify the set of articles that
                        most closely match a user's vector.
                    </p>
                </div>

                <div className="space-y-4">
                    <h2 className="text-2xl font-semibold">
                        Article ingestion
                    </h2>
                    <p className="text-lg">
                        To fetch the top stories, I use the Hacker News API.
                        Then, for each article that hasn't been processed
                        already, I use Playwright to capture a screenshot of the
                        article and scrape some of the textual content on the
                        page (I take a screenshot because parsing the text
                        content is not always reliable). To reduce the input
                        token count, I resize the image and make it grayscale.
                    </p>
                    <p className="text-lg">
                        In order to generate summaries of these articles, I used
                        AWS Bedrock. I opted for Claude 3 Haiku because it's
                        multi-modal, dirt cheap ($0.000125 per 1000 input tokens
                        and $0.000625 per 1000 output tokens), and good enough
                        for the basic task of generating concise summaries. In
                        particular, I'm using batch inference because it's
                        cheaper and articles don't need to be processed
                        on-demand. So, for each article, I create an entry in a
                        local JSONL file containing a prompt asking the model to
                        summarize the article along with a base64 representation
                        of the image and the text content of the article, and
                        whenever the number of entries exceeds 100 (this is the
                        minimum requirement for batch inference), the file is
                        uploaded to an S3 bucket and an inference job is created
                        which treats this uploaded file as the input.
                    </p>
                    <p className="text-lg">
                        After the inference job is complete, the output is
                        stored in another S3 bucket, so I set up another job on
                        the EC2 which repeatedly checks the output bucket for
                        new entries. Whenever it sees a new file, it grabs the
                        summaries of each article and writes them to a vector
                        database which I've hosted with PinconeDB.
                    </p>
                </div>

                <div className="space-y-4">
                    <h2 className="text-2xl font-semibold">
                        Sending newsletters
                    </h2>
                    <p className="text-lg">
                        In each user's vector representation, I store a
                        "last_updated" field which indicates the last time an
                        article was sent to that user. In another job, I
                        periodically query the vector database for "outdated"
                        users (their "last_updated" value is either 24 hours or
                        7 days in the past depending on their frequency
                        selection). Then, for each such user, I use Pinecone's
                        cosine similarity search to identify the set of article
                        vectors which are closest to that user's preference
                        vector and have not already been sent to them. I keep
                        track of which articles have already been sent to each
                        user in the same Supabase DB where I handle
                        authentication.
                    </p>
                    <p className="text-lg">
                        Once I know which articles to send to each user, I load
                        them into an HTML template with Jinja and send them to
                        the user with the SendGrid API.
                    </p>
                </div>

                <div className="space-y-4">
                    <h2 className="text-2xl font-semibold">
                        Tweaking preferences
                    </h2>
                    <p className="text-lg">
                        In the newsletters, I do not provide links directly to
                        the articles. Rather, they point to the "/redirect"
                        endpoint of this domain and have a query parameter which
                        specifies the ID of the Hacker News item. When the user
                        opens this link up, I use the ID in the query parameters
                        to fetch the vector representation of that article which
                        was generated during the ingestion process and also that
                        own user's vector. I then nudge that user's vector
                        slightly in the direction of the article's vector with
                        linear interpolation with an alpha of 0.98. Presumably,
                        users will mostly click on the articles they are
                        interested, so this way, that user's vector will slowly
                        become a more accurate representation of their
                        preferences over time.
                    </p>
                </div>

                <div className="space-y-4">
                    <h2 className="text-2xl font-semibold">Conclusion</h2>
                    <p className="text-lg">
                        This was a fun project to build and a good opportunity
                        to learn more about new services and refine my frontend
                        skills. I'm sure this idea of using LLMs for content
                        curation can be applied in some more meaningful way, but
                        I can't think of anything concrete yet. Thanks for
                        reading!
                    </p>
                </div>
            </section>
        </div>
    );
}
