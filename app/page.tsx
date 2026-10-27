import type { Metadata } from "next";
import { Library } from "@/components/library";

export const metadata: Metadata = {
  title: { absolute: "Biblioteca · Arcade Vault" },
};

export default function Home() {
  return <Library />;
}
