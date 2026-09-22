"use server";

import { redirect } from "next/navigation";
import { destroySession } from "./store";

export async function signOut(): Promise<never> {
  await destroySession();
  redirect("/login");
}
