import { redirect } from "next/navigation"

export default function RegisterPage() {
  // Регистрация отключена - редирект на страницу логина
  redirect('/auth/login')
}
