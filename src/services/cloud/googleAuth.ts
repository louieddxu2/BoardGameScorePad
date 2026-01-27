
import { GOOGLE_CLIENT_ID, GOOGLE_SCOPES } from '../../config';

declare global {
  interface Window {
    google: any;
  }
}

class GoogleAuthService {
  private tokenClient: any;
  private accessToken: string | null = null;
  private tokenExpiration: number = 0;

  constructor() {
    this.loadScripts();
  }

  private loadScripts() {
    if (document.getElementById('gsi-script')) {
        this.initTokenClient();
        return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.id = 'gsi-script';
    script.async = true;
    script.defer = true;
    script.onload = () => { this.initTokenClient(); };
    document.body.appendChild(script);
  }

  private initTokenClient() {
    if (window.google && window.google.accounts && !this.tokenClient) {
      try {
        this.tokenClient = window.google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID.trim(),
            scope: GOOGLE_SCOPES,
            callback: (tokenResponse: any) => {
            if (tokenResponse && tokenResponse.access_token) {
                this.accessToken = tokenResponse.access_token;
                this.tokenExpiration = Date.now() + (tokenResponse.expires_in * 1000);
            }
            },
        });
      } catch (e) {
          console.error("GSI Init Error:", e);
      }
    }
  }

  public get isAuthorized(): boolean {
    return !!this.accessToken && Date.now() < this.tokenExpiration;
  }

  public get token(): string | null {
      return this.accessToken;
  }

  public async signIn(options: { prompt?: string } = {}): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.tokenClient) {
        this.initTokenClient();
        if(!this.tokenClient) return reject(new Error('Google Identity Services script not loaded yet. Please try again.'));
      }

      this.tokenClient.callback = (resp: any) => {
        if (resp.error) {
            reject(resp);
        } else {
          this.accessToken = resp.access_token;
          this.tokenExpiration = Date.now() + (resp.expires_in * 1000);
          resolve(this.accessToken!);
        }
      };

      this.tokenClient.requestAccessToken({ prompt: options.prompt ?? '' });
    });
  }

  public async signOut(): Promise<void> {
      if (this.accessToken && window.google && window.google.accounts) {
          try {
              window.google.accounts.oauth2.revoke(this.accessToken, () => {
                  console.log('Access token revoked');
              });
          } catch (e) {
              console.warn('Revoke failed', e);
          }
      }
      this.accessToken = null;
      this.tokenExpiration = 0;
  }
}

export const googleAuth = new GoogleAuthService();
