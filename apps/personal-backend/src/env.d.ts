declare global {
  namespace NodeJS {
    interface ProcessEnv {
      PASSKEY_RP_ID: string;
      PASSKEY_RP_NAME: string;
    }
  }
}
