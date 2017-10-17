import fs from 'fs'
import path from 'path'
import Telegraf from 'telegraf'

import { PollManager } from './PollManager'
import { MessageStorage } from './MessageStorage'

require('dotenv').config()

const uuidRegexp = '[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}'
const bot = new Telegraf(process.env.BOT_TOKEN)
const messageStorage = new MessageStorage()
const pollManager = new PollManager(bot, messageStorage)

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

// Greeting
bot.use((ctx, next) => {
  const { message } = ctx

  if (message.new_chat_members) {
    const botId = +process.env.BOT_ID
    const didBotJoin = !!message.new_chat_members.find(member => member.id === botId)
    if (didBotJoin) {
      ctx.reply('Hi! Please grant me admin rights so I can ban users and remove spam messages.')
        .then(({ message_id: greetingMessageId, chat: { id: greetingChatId } }) => {
          return new Promise((resolve, reject) => {
            const interval = setInterval(
              () => bot.telegram
                .getChatMember(ctx.chat.id, botId)
                .then(({ status }) => {
                  if (status === 'administrator') {
                    bot.telegram.deleteMessage(greetingChatId, greetingMessageId)
                    clearInterval(interval)
                    resolve()
                  }
                }),
               1500
            )

            setTimeout(() => {
              clearInterval(interval)
              reject(new Error('Please grant me admin rights or I am useless for you. I\'ll be silently waiting for it'))
            }, 60 * 1000)
          })
        })
        .then(
          () => ctx.reply('Great! I can do everything you need now. Reply with `/ban`, `/mute` or `/spam` to trigger a vote on selected user.', { parse_mode: 'Markdown' }),
          (error) => ctx.reply(error.message)
        )
    }
  }

  next(ctx)
})

// Adding message to message storage
bot.use((ctx) => {
  const { message_id: messageId, from: { id: userId }, chat: { id: chatId } } = ctx.message
  messageStorage.add({ messageId, userId, chatId })
})

if (process.env.WEBHOOK_URL && process.env.WEBHOOK_SECRET && process.env.CERT_PATH) {
  const fullUrl = process.env.WEBHOOK_URL + process.env.WEBHOOK_SECRET
  const certPath = process.env.CERT_PATH

  const tlsOptions = {
    key: fs.readFileSync(path.join(certPath, 'privkey1.pem')),
    cert: fs.readFileSync(path.join(certPath, 'fullchain1.pem')),
    ca: [
      fs.readFileSync(path.join(certPath, 'chain1.pem'))
    ]
  }

  bot.telegram
    .setWebhook(fullUrl, null, 5000)
    .then(() => {
      bot.startWebhook(
        process.env.WEBHOOK_SECRET,
        tlsOptions,
        8443
      )
    })
} else {
  bot.telegram.deleteWebhook().then(() => bot.startPolling())
}
