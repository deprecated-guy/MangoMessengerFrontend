import {Component, OnInit} from '@angular/core';
import {ActivatedRoute, Router} from "@angular/router";
import {AuthService} from "../../services/auth.service";
import {ChatsService} from "../../services/chats.service";
import {MessagesService} from "../../services/messages.service";
import {IGetUserChatsResponse} from "../../../types/responses/IGetUserChatsResponse";
import {IGetChatMessagesResponse} from "../../../types/responses/IGetChatMessagesResponse";
import {SendMessageCommand} from "../../../types/requests/SendMessageCommand";
import {ISendMessageResponse} from "../../../types/responses/ISendMessageResponse";
import {IChat} from 'src/types/Models/IChat';
import {IMessage} from "../../../types/models/IMessage";

@Component({
  selector: 'app-main',
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.scss']
})
export class MainComponent implements OnInit {

  // @ts-ignore
  getUserChatsResponse: IGetUserChatsResponse;

  messages: IMessage[] = [];
  chats: IChat[] = [];

  activeChatId = '';
  // @ts-ignore
  activeMessageText: string = '';

  activeChatTitle: string = '';
  activeChatMembersCount: number = 0;

  constructor(private authService: AuthService,
              private chatService: ChatsService,
              private messageService: MessagesService,
              private route: ActivatedRoute,
              private router: Router) {
  }

  ngOnInit(): void {
    this.chatService.getUserChats().subscribe((data: IGetUserChatsResponse) => {
        this.getUserChatsResponse = data;
        this.chats = data.chats;
      },
      error => {
        if (error && error.status) {
          switch (error.status) {
            case 409:
              alert(error.message);
              break;
          }
        }
      });
  }

  reloadComponent(component: string): void {
    this.router.routeReuseStrategy.shouldReuseRoute = () => false;
    this.router.onSameUrlNavigation = 'reload';
    this.router.navigate([component]).then(r => r);
  }

  getChatMessages(chatId: string): void {
    this.messageService.getChatMessages(chatId).subscribe((data: IGetChatMessagesResponse) => {
        this.messages = data.messages;
        this.activeChatId = chatId;
        let chat = this.getUserChatsResponse.chats.filter(x => x.chatId === chatId)[0];
        this.activeChatTitle = chat.title;
        this.activeChatMembersCount = chat.membersCount;
        this.scrollToEnd();
      },
      error => {
        if (error && error.response) {
          switch (error.response.status) {
            case 400:
              alert(error.message);
              break;
          }
        }
      });
  }

  scrollToEnd(): void {
    setTimeout(() => {
      let element = document.getElementById('messageList');
      element?.scrollIntoView({block: "end"});
    }, 0);
  }

  sendMessage(): void {
    this.messageService.sendMessage(new SendMessageCommand(this.activeMessageText, this.activeChatId))
      .subscribe((data: ISendMessageResponse) => {
      }, error => {
        if (error && error.response) {
          switch (error.response.status) {
            case 400:
              alert(error.message);
              break;
          }
        }
      });
  }
}
