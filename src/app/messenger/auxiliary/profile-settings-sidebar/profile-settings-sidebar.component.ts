import {Component, OnInit} from '@angular/core';
import {SessionService} from "../../../services/session.service";
import {ActivatedRoute, Router} from "@angular/router";
import {ILogoutResponse} from "../../../../types/responses/ILogoutResponse";

@Component({
  selector: 'app-profile-settings-sidebar',
  templateUrl: './profile-settings-sidebar.component.html',
  styleUrls: ['./profile-settings-sidebar.component.scss']
})
export class ProfileSettingsSidebarComponent implements OnInit {

  constructor(private sessionService: SessionService,
              private route: ActivatedRoute,
              private router: Router) {
  }

  ngOnInit(): void {
  }

  logout(): void {
    let refreshToken = this.sessionService.getRefreshToken();
    this.sessionService.deleteSession(refreshToken)
      .subscribe((data: ILogoutResponse) => {
        this.sessionService.writeAccessToken('');
        this.sessionService.writeRefreshToken('');
        this.router.navigateByUrl('login').then(r => r);
      }, error => {
        alert(error.message);
      })
  }

  logoutAll(): void {
    let refreshToken = this.sessionService.getRefreshToken();
    this.sessionService.deleteAllSessions(refreshToken)
      .subscribe((data: ILogoutResponse) => {
        this.sessionService.writeAccessToken('');
        this.sessionService.writeRefreshToken('');
        this.router.navigateByUrl('login').then(r => r);
      }, error => {
        alert(error.message);
      })
  }

}
