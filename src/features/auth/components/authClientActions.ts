import { signInWithEmail as serverSignIn, signUpWithEmail as serverSignUp, signInWithMagicLink as serverMagicLink } from "../api/authActions";

export async function signInWithEmail(formData: FormData) {
  return await serverSignIn(formData);
}

export async function signUpWithEmail(formData: FormData) {
  return await serverSignUp(formData);
}

export async function signInMagicLinkAction(formData: FormData) {
  return await serverMagicLink(formData);
}
