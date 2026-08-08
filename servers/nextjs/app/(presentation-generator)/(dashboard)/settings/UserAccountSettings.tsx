import { UserRound } from "lucide-react";

import LogoutButton from "@/components/Auth/LogoutButton";

type UserAccountSettingsProps = {
  username: string;
};

export default function UserAccountSettings({
  username,
}: UserAccountSettingsProps) {
  return (
    <div className="relative flex h-screen flex-col overflow-hidden font-syne">
      <main className="mx-auto flex w-full gap-6 overflow-hidden">
        <aside
          className="flex h-screen w-full max-w-[230px] flex-col bg-[#F9FAFB] px-3 pt-[22px]"
          aria-label="Account settings"
        >
          <p className="mt-[3.15rem] border-b border-[#E1E1E5] pb-3.5 text-xs font-medium text-black">
            FILTER BY:
          </p>
          <div className="mt-6">
            <p className="pb-2.5 text-xs font-medium text-[#3A3A3A]">
              Account
            </p>
            <div
              className="flex w-full items-center gap-1.5 rounded-[6px] border border-[#D9D6FE] bg-[#F4F3FF] px-3 py-4"
              aria-current="page"
            >
              <div className="flex h-[18px] w-[18px] items-center justify-center rounded-full border border-[#EDEEEF] bg-white">
                <UserRound
                  className="h-3 w-3 text-[#5146E5]"
                  aria-hidden="true"
                />
              </div>
              <p className="text-xs font-medium text-[#191919]">Account</p>
            </div>
          </div>
        </aside>

        <div className="w-full overflow-y-auto pb-20 pr-6">
          <div className="sticky right-0 top-0 z-50 mb-4 py-[28px] backdrop-blur">
            <h1 className="font-unbounded text-[28px] font-normal tracking-[-0.84px] text-black">
              Settings
            </h1>
          </div>

          <section
            className="max-w-3xl rounded-[12px] bg-[#F9F8F8] p-7"
            aria-labelledby="account-heading"
          >
            <h2
              id="account-heading"
              className="text-sm font-semibold text-[#191919]"
            >
              Account
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-[#6B7280]">
              Review your signed-in account and end the current session.
            </p>

            <div className="mt-6 rounded-[12px] border border-[#EDEEEF] bg-white p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[4px] bg-[#F4F3FF]">
                  <UserRound
                    className="h-5 w-5 text-[#5146E5]"
                    aria-hidden="true"
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-[#77787C]">
                    Signed in as
                  </p>
                  <p className="mt-1 truncate text-sm font-semibold text-[#191919]">
                    {username}
                  </p>
                </div>
              </div>

              <div className="mt-6 border-t border-[#EDEEEF] pt-6">
                <p className="text-sm font-semibold text-[#191919]">
                  Sign out
                </p>
                <p className="mt-1 text-xs leading-relaxed text-[#6B7280]">
                  You will need to sign in again to access your workspace.
                </p>
                <LogoutButton
                  label="Sign out"
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-[58px] border border-[#EDEEEF] bg-[#7C51F8] px-5 py-3 text-xs font-semibold text-white transition hover:bg-[#6d46e6] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                />
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
