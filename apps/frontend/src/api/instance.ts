import { http } from "@/lib/http"
import type { EmailInput, EmailSettings } from "./types"

export const instanceApi = {
    email: () => http.get<EmailSettings>("/instance/email").then((r) => r.data),
    saveEmail: (input: { email: EmailInput | null; appUrl?: string }) => http.put("/instance/email", input).then(() => undefined),
    testEmail: (email: EmailInput, to: string) => http.post("/instance/email/test", { email, to }).then(() => undefined),
}
