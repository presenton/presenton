import type { Metadata } from "next";

import CommunityPage from "./components/CommunityPage";

export const metadata: Metadata = {
  title: "Community",
  description: "Explore community presentation designs and prompts.",
};

export default function Page() {
  return <CommunityPage />;
}
