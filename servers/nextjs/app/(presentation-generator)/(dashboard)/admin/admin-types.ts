export type AdminUser = {
  id: string;
  username: string;
  role: "admin" | "user";
  created_at?: string | null;
};

export type ApiKey = {
  id: string;
  user_id: string;
  created_by_id: string;
  label: string;
  created_at: string;
  expires_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};
