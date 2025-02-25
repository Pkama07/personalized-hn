import Redirect from "@/app/redirect/Redirect";
import { Suspense } from "react";

export default function Page() {
    return (
        <Suspense>
            <Redirect />
        </Suspense>
    );
}
