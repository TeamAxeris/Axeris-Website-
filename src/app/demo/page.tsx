import { redirect } from "next/navigation";

export default function DemoPage() {
  redirect("/console/tpa/dashboard?demo=1");
}
