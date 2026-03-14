export interface SamlFormValues {
  name: string;
  entityId: string;
  ssoUrl: string;
  sloUrl: string;
  cert: string;
  domain: string;
}

export type SubTab = "guide" | "sp" | "idp";
