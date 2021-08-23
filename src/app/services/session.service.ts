import {Injectable} from '@angular/core';
import {HttpClient, HttpHeaders} from "@angular/common/http";
import {Observable} from "rxjs";
import {Tokens} from "../../consts/Tokens";
import {ISessionService} from "../../types/interfaces/ISessionService";
import {LoginCommand} from "../../types/requests/LoginCommand";
import {ITokensResponse} from "../../types/responses/ITokensResponse";
import {ApiRoute} from "../../consts/ApiRoute";
import {IBaseResponse} from "../../types/responses/IBaseResponse";

@Injectable({
  providedIn: 'root'
})
export class SessionService implements ISessionService {
  private sessionsRoute = 'api/sessions/'

  constructor(private httpClient: HttpClient) {
  }

  postSession(command: LoginCommand): Observable<ITokensResponse> {
    return this.httpClient.post<ITokensResponse>(ApiRoute.route + this.sessionsRoute, command,
      {withCredentials: true});
  }

  postRefreshSession(refreshToken: string | null): Observable<ITokensResponse> {
    return this.httpClient.post<ITokensResponse>(ApiRoute.route + this.sessionsRoute + refreshToken, {});
  }

  deleteSession(refreshToken: string | null): Observable<IBaseResponse> {
    const accessToken = this.getAccessToken();

    const header = {
      headers: new HttpHeaders().set('Authorization', `Bearer ${accessToken}`)
    };

    return this.httpClient.delete<IBaseResponse>(ApiRoute.route + this.sessionsRoute + refreshToken, header);
  }

  deleteAllSessions(refreshToken: string | null): Observable<IBaseResponse> {
    const accessToken = this.getAccessToken();

    const header = {
      headers: new HttpHeaders().set('Authorization', `Bearer ${accessToken}`)
    };

    return this.httpClient.delete<IBaseResponse>(ApiRoute.route + this.sessionsRoute, header);
  }

  getAccessToken(): string | null {
    return localStorage.getItem(Tokens.accessToken);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(Tokens.refreshToken);
  }

  writeAccessToken(token: string): void {
    localStorage.setItem(Tokens.accessToken, token);
  }

  writeRefreshToken(tokenId: string): void {
    localStorage.setItem(Tokens.refreshToken, tokenId);
  }
}
