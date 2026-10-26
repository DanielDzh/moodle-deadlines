/** What the bot needs from storage. Implemented over D1 in production and in memory in tests. */
export interface BotRepo {
  /** Binds the chat to the pending user that owns the code. False if the code is unknown, expired or used. */
  bindChat: (code: string, chatId: number, now: number) => Promise<boolean>;
  /** Deletes the chat's user together with all their data. False if the chat was not linked. */
  deleteByChat: (chatId: number) => Promise<boolean>;
  /** How many upcoming unfinished tasks are tracked for the chat; null if the chat is not linked. */
  trackedTasks: (chatId: number, now: number) => Promise<number | null>;
}

export interface BotCore {
  start: (chatId: number, payload: string) => Promise<string>;
  stop: (chatId: number) => Promise<string>;
  status: (chatId: number) => Promise<string>;
  help: () => string;
}
