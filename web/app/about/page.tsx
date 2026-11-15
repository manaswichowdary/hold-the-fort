import { redirect } from "next/navigation";

// About now lives on the home page as a section
export default function AboutPage() {
  redirect("/#about");
}
