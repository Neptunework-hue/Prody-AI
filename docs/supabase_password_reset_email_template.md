# Supabase password reset email (link + 6-digit code)

The app calls `resetPasswordForEmail` with your **Expo tunnel** redirect URL.  
You must customize the Supabase email template so users get **both** a link and a code.

## 1. Redirect URLs (Supabase Dashboard)

**Authentication → URL configuration → Redirect URLs**

Add the URLs printed in Metro when you run `npx expo start --tunnel`, for example:

```
exp://YOUR-SUBDOMAIN.exp.direct:8082/--/(auth)/forgot-password?recovery=1
https://YOUR-SUBDOMAIN.exp.direct:8082/--/(auth)/forgot-password?recovery=1
```

Optional in `.env`:

```
EXPO_PUBLIC_PASSWORD_RESET_REDIRECT_URL=exp://YOUR-SUBDOMAIN.exp.direct:8082/--/(auth)/forgot-password?recovery=1
```

## 2. Reset password email template

**Authentication → Email Templates → Reset password**

Use a body that includes **both** the confirmation link and the OTP token:

```html
<h2>Reset your ProdyAI password</h2>

<p>Tap the button to open the app (Expo tunnel / deep link):</p>
<p><a href="{{ .ConfirmationURL }}">Reset password in app</a></p>

<p>Or enter this 6-digit verification code in the app if the link does not open:</p>
<p style="font-size: 24px; font-weight: bold; letter-spacing: 4px;">{{ .Token }}</p>

<p>This code expires shortly. If you did not request a reset, ignore this email.</p>
```

Save the template.

## 3. In the app

1. **Forgot Password?** → enter email → **Send Reset Link**
2. **Option A:** Tap the email link → app opens → set new password  
3. **Option B:** On “Check your email”, enter the **6-digit code** → **Verify code** → set new password
