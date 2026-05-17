import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { TextInput, Button, Text, HelperText } from 'react-native-paper';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../services/supabase/supabase';

type Step = 'email' | 'check_email' | 'reset' | 'done';

const inputTheme = {
  colors: {
    onSurfaceVariant: '#b8a98f',
    background: '#17151f',
  },
};

const inputProps = {
  mode: 'outlined' as const,
  outlineColor: '#51486b',
  activeOutlineColor: '#f5a623',
  textColor: '#f4ead8',
  theme: inputTheme,
};

export default function ForgotPassword() {
  const { recovery } = useLocalSearchParams<{ recovery?: string }>();
  const [step, setStep] = useState<Step>('email');
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const {
    checkEmailRegistered,
    sendPasswordResetEmail,
    verifyPasswordResetCode,
    updatePasswordAfterRecovery,
    completePasswordResetWithOtp,
  } = useAuth();

  useEffect(() => {
    if (recovery === '1') {
      setRecoveryReady(true);
      setStep('reset');
    }
  }, [recovery]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session) {
        setRecoveryReady(true);
        setStep('reset');
        if (session.user.email) {
          setEmail(session.user.email);
        }
      }
    });

    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && recovery === '1') {
        setRecoveryReady(true);
        setStep('reset');
        if (session.user.email) {
          setEmail(session.user.email);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [recovery]);

  const handleContinue = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      setError('Please enter your email');
      return;
    }

    setLoading(true);
    setError('');

    const { exists, error: checkError, uncertain } = await checkEmailRegistered(trimmed);

    if (!exists) {
      setError('No account found for this email');
      setLoading(false);
      return;
    }

    if (checkError && !uncertain) {
      setError('Could not verify email. Try again.');
      setLoading(false);
      return;
    }

    const { error: sendError } = await sendPasswordResetEmail(trimmed);

    setLoading(false);

    if (sendError) {
      setError('Could not send reset email. Try again.');
      return;
    }

    setOtp('');
    setStep('check_email');
  };

  const handleVerifyCode = async () => {
    const trimmedEmail = email.trim();
    const code = otp.trim();

    if (!code) {
      setError('Enter the 6-digit verification code from your email');
      return;
    }

    if (code.length < 6) {
      setError('Verification code must be 6 digits');
      return;
    }

    setLoading(true);
    setError('');

    const { error: verifyError } = await verifyPasswordResetCode(trimmedEmail, code);

    setLoading(false);

    if (verifyError) {
      setError('Invalid or expired code. Check your email or resend.');
      return;
    }

    setRecoveryReady(true);
    setStep('reset');
  };

  const handleResetPassword = async () => {
    if (!newPassword || !confirmPassword) {
      setError('Please fill in both password fields');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    setError('');

    let resetError: unknown = null;

    if (recoveryReady) {
      const result = await updatePasswordAfterRecovery(newPassword);
      resetError = result.error;
    } else {
      const code = otp.trim();
      if (!code) {
        setError('Enter the code from your email, or open the reset link in the email');
        setLoading(false);
        return;
      }
      const result = await completePasswordResetWithOtp(email.trim(), code, newPassword);
      resetError = result.error;
    }

    setLoading(false);

    if (resetError) {
      setError(
        recoveryReady
          ? 'Password update failed. Open the reset link from your email and try again.'
          : 'Invalid code or password update failed. Check the code or use the email link.',
      );
      return;
    }

    setStep('done');
  };

  const handleResendEmail = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      setStep('email');
      return;
    }

    setLoading(true);
    setError('');
    const { error: sendError } = await sendPasswordResetEmail(trimmed);
    setLoading(false);
    if (sendError) {
      setError('Could not resend reset email. Try again.');
    } else {
      setError('');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.glowOne} />
      <View style={styles.glowTwo} />
      <View style={styles.glowThree} />

      <Text style={[styles.star, styles.starOne]}>✦</Text>
      <Text style={[styles.star, styles.starTwo]}>✧</Text>
      <Text style={[styles.star, styles.starThree]}>✦</Text>
      <Text style={[styles.star, styles.starFour]}>✧</Text>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>✦</Text>
          </View>

          {step === 'done' ? (
            <>
              <Text style={styles.title}>Password Updated</Text>
              <Text style={styles.subtitle}>
                Your password has been changed. Sign in with your new password.
              </Text>

              <Button
                mode="contained"
                onPress={() => router.replace('/(auth)/login')}
                style={styles.mainButton}
                buttonColor="#f5a623"
                textColor="#15121a"
                labelStyle={styles.mainButtonLabel}
              >
                Back to Login
              </Button>
            </>
          ) : step === 'email' ? (
            <>
              <Text style={styles.title}>Reset Password</Text>
              <Text style={styles.subtitle}>
                Enter your account email. We'll email a reset link (opens via your Expo tunnel) and a
                6-digit code you can enter if the link does not work.
              </Text>

              <TextInput
                label="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                style={styles.input}
                {...inputProps}
              />

              {error ? (
                <HelperText type="error" visible={!!error} style={styles.errorText}>
                  {error}
                </HelperText>
              ) : null}

              <Button
                mode="contained"
                onPress={handleContinue}
                loading={loading}
                disabled={loading}
                style={styles.mainButton}
                buttonColor="#f5a623"
                textColor="#15121a"
                labelStyle={styles.mainButtonLabel}
              >
                Send reset email
              </Button>

              <Button
                mode="text"
                onPress={() => router.replace('/(auth)/login')}
                textColor="#b8a98f"
                labelStyle={styles.linkText}
                style={styles.backButton}
              >
                Back to Login
              </Button>
            </>
          ) : step === 'check_email' ? (
            <>
              <Text style={styles.title}>Check Your Email</Text>
              <Text style={styles.subtitle}>
                We sent a message to{'\n'}
                <Text style={styles.emailHighlight}>{email.trim()}</Text>
                {'\n\n'}
                <Text style={styles.optionHeading}>Option 1 — Reset link</Text>
                {'\n'}
                Tap the link in the email. It opens ProdyAI using your{' '}
                <Text style={styles.emailHighlight}>Expo tunnel</Text> URL, then you can set a new
                password.
                {'\n\n'}
                <Text style={styles.optionHeading}>Option 2 — Verification code</Text>
                {'\n'}
                If the link does not open the app, enter the 6-digit code from the email below.
              </Text>

              <TextInput
                label="6-digit verification code"
                value={otp}
                onChangeText={setOtp}
                keyboardType="number-pad"
                autoCapitalize="none"
                maxLength={6}
                style={styles.input}
                {...inputProps}
              />

              {error ? (
                <HelperText type="error" visible={!!error} style={styles.errorText}>
                  {error}
                </HelperText>
              ) : null}

              <Button
                mode="contained"
                onPress={handleVerifyCode}
                loading={loading}
                disabled={loading}
                style={styles.mainButton}
                buttonColor="#f5a623"
                textColor="#15121a"
                labelStyle={styles.mainButtonLabel}
              >
                Verify code
              </Button>

              <Button
                mode="outlined"
                onPress={() => {
                  void supabase.auth.getSession().then(({ data: { session } }) => {
                    if (session) {
                      setRecoveryReady(true);
                      setStep('reset');
                      setError('');
                    } else {
                      setError(
                        'Open the reset link in your email first, or enter the verification code above.',
                      );
                    }
                  });
                }}
                style={styles.outlineButton}
                textColor="#f5a623"
                labelStyle={styles.linkText}
              >
                I used the link — set password
              </Button>

              <View style={styles.secondaryActions}>
                <Button
                  mode="text"
                  onPress={handleResendEmail}
                  disabled={loading}
                  textColor="#f5a623"
                  labelStyle={styles.linkText}
                >
                  Resend email
                </Button>
                <Button
                  mode="text"
                  onPress={() => {
                    setStep('email');
                    setOtp('');
                    setError('');
                  }}
                  textColor="#b8a98f"
                  labelStyle={styles.linkText}
                >
                  Change email
                </Button>
              </View>

              <Button
                mode="text"
                onPress={() => router.replace('/(auth)/login')}
                textColor="#b8a98f"
                labelStyle={styles.linkText}
                style={styles.backButton}
              >
                Back to Login
              </Button>
            </>
          ) : (
            <>
              <Text style={styles.title}>New Password</Text>
              <Text style={styles.subtitle}>
                {recoveryReady
                  ? 'Your reset link was verified. Choose a new password below.'
                  : `Enter the code from the email sent to\n${email.trim()}, or go back and open the reset link.`}
              </Text>

              <TextInput
                label="New password"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                style={styles.input}
                {...inputProps}
              />

              <TextInput
                label="Confirm new password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                style={styles.input}
                {...inputProps}
              />

              {error ? (
                <HelperText type="error" visible={!!error} style={styles.errorText}>
                  {error}
                </HelperText>
              ) : null}

              <Button
                mode="contained"
                onPress={handleResetPassword}
                loading={loading}
                disabled={loading}
                style={styles.mainButton}
                buttonColor="#f5a623"
                textColor="#15121a"
                labelStyle={styles.mainButtonLabel}
              >
                Update Password
              </Button>

              {!recoveryReady ? (
                <View style={styles.secondaryActions}>
                  <Button
                    mode="text"
                    onPress={handleResendEmail}
                    disabled={loading}
                    textColor="#f5a623"
                    labelStyle={styles.linkText}
                  >
                    Resend link
                  </Button>
                  <Button
                    mode="text"
                    onPress={() => setStep('check_email')}
                    textColor="#b8a98f"
                    labelStyle={styles.linkText}
                  >
                    Waiting for email
                  </Button>
                </View>
              ) : null}

              <Button
                mode="text"
                onPress={() => router.replace('/(auth)/login')}
                textColor="#b8a98f"
                labelStyle={styles.linkText}
                style={styles.backButton}
              >
                Back to Login
              </Button>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#090712',
    overflow: 'hidden',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  glowOne: {
    position: 'absolute',
    width: 360,
    height: 360,
    borderRadius: 180,
    backgroundColor: 'rgba(245, 166, 35, 0.14)',
    top: -90,
    left: -120,
  },
  glowTwo: {
    position: 'absolute',
    width: 420,
    height: 420,
    borderRadius: 210,
    backgroundColor: 'rgba(112, 72, 232, 0.20)',
    bottom: -150,
    right: -130,
  },
  glowThree: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(245, 166, 35, 0.08)',
    top: '45%',
    right: -90,
  },
  star: {
    position: 'absolute',
    color: '#f5a623',
    opacity: 0.8,
  },
  starOne: {
    top: 90,
    left: 48,
    fontSize: 16,
  },
  starTwo: {
    top: 170,
    right: 70,
    fontSize: 12,
  },
  starThree: {
    bottom: 120,
    left: 82,
    fontSize: 14,
  },
  starFour: {
    bottom: 210,
    right: 44,
    fontSize: 18,
  },
  card: {
    width: '100%',
    maxWidth: 430,
    backgroundColor: 'rgba(23, 21, 31, 0.94)',
    borderRadius: 28,
    padding: 26,
    borderWidth: 1,
    borderColor: '#5c5278',
    shadowColor: '#f5a623',
    shadowOpacity: 0.22,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignSelf: 'center',
    backgroundColor: '#241b14',
    borderWidth: 1.5,
    borderColor: '#f5a623',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
    shadowColor: '#f5a623',
    shadowOpacity: 0.55,
    shadowRadius: 18,
    elevation: 8,
  },
  logoText: {
    color: '#f5a623',
    fontSize: 34,
    fontWeight: '700',
  },
  title: {
    color: '#f4ead8',
    fontSize: 32,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    color: '#b8a98f',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 28,
  },
  emailHighlight: {
    color: '#f5a623',
    fontWeight: '600',
  },
  optionHeading: {
    color: '#f4ead8',
    fontWeight: '700',
  },
  outlineButton: {
    borderRadius: 18,
    borderColor: '#f5a623',
    marginTop: 10,
  },
  input: {
    marginBottom: 14,
    backgroundColor: '#17151f',
  },
  errorText: {
    marginBottom: 4,
  },
  mainButton: {
    borderRadius: 18,
    paddingVertical: 6,
    marginTop: 8,
    shadowColor: '#f5a623',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 5,
  },
  mainButtonLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryActions: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    marginTop: 8,
  },
  linkText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
