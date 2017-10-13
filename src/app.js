import dotenv from 'dotenv'
import Telegraf from 'telegraf'

import { PollManager } from './PollManager'

dotenv.config()

const uuidRegexp = '[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}'
const bot = new Telegraf(process.env.BOT_TOKEN)
const pollManager = new PollManager(bot)

bot.telegram.getMe().then((botInfo) => {
  bot.options.username = botInfo.username
})

bot.command(['/ban', '/mute', '/spam'], (ctx) => {
  const { message } = ctx
  const type = ctx.update.message.text.split('/')[1]

  if (!message.reply_to_message) {
    return
  }

  const chatId = message.chat.id
  const initiator = message.from
  const victim = message.reply_to_message.from

  pollManager.createPoll({ chatId, initiator, victim }, type)
})

bot.action(new RegExp(`votepunish:${uuidRegexp}$`, 'i'), (ctx) => {
  const pollId = ctx.match[0].split(':')[1]
  const user = ctx.update.callback_query.from

  const poll = pollManager.activePolls.get(pollId)
  if (poll) {
    poll.votePunish(user)
  }
})

bot.action(new RegExp(`votesave:${uuidRegexp}$`, 'i'), (ctx) => {
  const pollId = ctx.match[0].split(':')[1]
  const user = ctx.update.callback_query.from

  const poll = pollManager.activePolls.get(pollId)
  if (poll) {
    poll.voteSave(user)
  }
})

bot.startPolling()
