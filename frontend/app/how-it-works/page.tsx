export default function HowItWorks() {
    return (
        <div className="min-h-screen flex flex-col items-center p-8 max-w-3xl mx-auto">
            <h1 className="text-4xl font-bold mb-8">
                How hackern<span className="text-primary">you</span>sletter
                works
            </h1>

            <section className="space-y-6 w-full">
                <div className="space-y-4">
                    <h2 className="text-2xl font-semibold">1. Sign Up</h2>
                    <p className="text-lg">
                        Create an account to get started. We&apos;ll send you a
                        verification email to confirm your address.
                    </p>
                </div>

                <div className="space-y-4">
                    <h2 className="text-2xl font-semibold">
                        2. Choose Your Frequency
                    </h2>
                    <p className="text-lg">
                        Select whether you want to receive updates daily or
                        weekly. For weekly updates, you can pick your preferred
                        day of the week.
                    </p>
                </div>

                <div className="space-y-4">
                    <h2 className="text-2xl font-semibold">
                        3. Set Your Interests
                    </h2>
                    <p className="text-lg">
                        Tell us what kind of content you&apos;re interested in
                        from Hacker News. We&apos;ll curate stories based on
                        your preferences.
                    </p>
                </div>

                <div className="space-y-4">
                    <h2 className="text-2xl font-semibold">
                        4. Receive Your Newsletter
                    </h2>
                    <p className="text-lg">
                        We&apos;ll send you a personalized digest of the best
                        Hacker News content matching your interests, delivered
                        right to your inbox.
                    </p>
                </div>
                <div className="space-y-4">
                    <h2 className="text-2xl font-semibold">
                        5. Read the stories
                    </h2>
                    <p className="text-lg">
                        As you click on more stories, we fine-tune our
                        representation of your preferences so that the
                        newsletter becomes increasingly personalized.
                    </p>
                </div>
            </section>
        </div>
    );
}
