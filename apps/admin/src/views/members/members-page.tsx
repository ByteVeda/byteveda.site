import { MAIL_WORKSPACE_LABELS, MAIL_WORKSPACES } from "@byteveda/db/constants";
import { PageHeader } from "@/components";
import { can, roleLabel } from "@/lib/auth/roles";
import { requirePermission } from "@/lib/auth/session";
import { ago } from "@/lib/format";
import { listMembers, type Member } from "@/lib/members/queries";
import { InviteForm, MemberControls } from "./member-controls";

/**
 * Who has access, and what to.
 *
 * Only a super admin can change anything here — `members.manage` is in no
 * role's permission set — but `members.read` lets an admin see the list, which
 * is the difference between "you cannot do this" and "you cannot see who can".
 *
 * A list, not a form, so it takes the full width. It used to be `content-form`
 * at 720px, which is narrower than the row's own columns add up to: the name
 * column collapsed to nothing and the header printed "Member" and "Role" on
 * top of each other. The invite panel is the form, and it constrains itself.
 */
export async function MembersPage() {
  const { access, user } = await requirePermission("members.read");
  const members = await listMembers();
  const manage = can(access, "members.manage");

  const pending = members.filter((member) => member.user.lastLoginAt === null).length;

  return (
    <>
      <PageHeader
        title="Members"
        sub={`${members.length} with access${pending > 0 ? `, ${pending} not signed in yet` : ""}`}
      />

      <div className="content content-narrow">
        {!manage && (
          <div className="notice notice-warn block-gap">
            <span>
              You can see who has access, but only a super admin can change it. Super admins are a
              hardcoded list of GitHub ids — nothing in this console can add one.
            </span>
          </div>
        )}

        <div className="rows block-gap">
          <div className="row row-head row-member">
            <span>Member</span>
            <span>Role</span>
            <span>Mail</span>
            <span className="num">Last seen</span>
            <span />
          </div>

          {members.map((member) => (
            <MemberRow
              key={member.user.id}
              member={member}
              manage={manage}
              isSelf={member.user.id === user.id}
            />
          ))}
        </div>

        {manage && <InviteForm />}
      </div>
    </>
  );
}

function MemberRow({
  member,
  manage,
  isSelf,
}: {
  member: Member;
  manage: boolean;
  isSelf: boolean;
}) {
  const { user, access, activeSessions } = member;
  const suspended = user.status === "suspended" && !access.superAdmin;

  return (
    <div className="row row-member" data-suspended={suspended}>
      <span className="member-who">
        {user.avatarUrl ? <img src={user.avatarUrl} alt="" width={26} height={26} /> : null}
        <span>
          <b className="row-title">{user.name ?? user.login}</b>
          <span className="row-sub">@{user.login}</span>
        </span>
      </span>

      <span className={`state ${access.superAdmin ? "state-published" : "state-draft"}`}>
        {roleLabel(access)}
      </span>

      <span className="member-mail">
        {access.workspaces.length === 0 ? (
          <span className="num-dim">none</span>
        ) : (
          MAIL_WORKSPACES.filter((workspace) => access.workspaces.includes(workspace))
            .map((workspace) => MAIL_WORKSPACE_LABELS[workspace])
            .join(" · ")
        )}
      </span>

      <span className="num num-dim">
        {user.lastLoginAt ? ago(user.lastLoginAt) : "never"}
        {activeSessions > 0 && <i className="member-live" title="Signed in right now" />}
      </span>

      {manage ? (
        <MemberControls
          id={user.id}
          login={user.login}
          role={user.role}
          status={user.status}
          workspaces={[...user.mailWorkspaces]}
          // A super admin's row is a display of something set in the source.
          // Locked rather than hidden: the reason is worth seeing.
          locked={access.superAdmin || isSelf}
          lockedReason={
            access.superAdmin
              ? "Super admins are set in lib/auth/roles.ts."
              : "This is you. Ask the other super admin."
          }
        />
      ) : (
        <span />
      )}
    </div>
  );
}
