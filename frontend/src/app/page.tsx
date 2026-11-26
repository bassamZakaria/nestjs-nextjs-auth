import type { Metadata } from "next";
import { AppHome } from "@/components/app-home";

export const metadata: Metadata = { title: "Welcome" };

export default function HomePage() {
  return <AppHome />;
}
