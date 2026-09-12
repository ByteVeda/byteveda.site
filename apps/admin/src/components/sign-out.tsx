import { LogOut } from "lucide-react";
import { signOut } from "@/lib/auth/actions";

export function SignOut() {
  return (
    <form action={signOut}>
      <button type="submit" className="icon-btn" title="Sign out" aria-label="Sign out">
        <LogOut width={15} height={15} aria-hidden />
      </button>
    </form>
  );
}
