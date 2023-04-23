const RANKS = ["[VIP] ", "[VIP+] ", "[MVP] ", "[MVP+] ", "[MVP++] "]

GREEK_LETTERS = {
    "e": "Ε",
    "b": "Β",
    "t": "Τ",
    "o": "Ο",
    "n": "Ν",
    "a": "Α",
    "i": "Ι"
}

const axios = require("axios");
const mineflayer = require("mineflayer");
const { Client, Events, GatewayIntentBits, SlashCommandBuilder, REST, Routes, EmbedBuilder, WebhookClient } = require("discord.js");
const express = require("express");
const os = require('os');

const app = express();
app.listen(80);

const discordToken = process.env["MTA5MzE0NTE3MDY0OTgwOTAyNg.GZSA0O.72Vi4VMW9btIpYWccfXVOe0LSbuF2nUJWr_Zik"];
const channelId = process.env["1093144675189272628"];
const guildId = process.env["1093144674534965260"];
const clientId = process.env["1093145170649809026"];

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });
const bots = {};
var lobby = 1;

async function registerCommand() {
    const activateCommand = new SlashCommandBuilder()
        .setName("activate")
        .setDescription("Activate lobby spammer bot")
        .addStringOption(option => option.setName("lobby_msg").setDescription("Lobby message").setRequired(true))
        .addStringOption(option => option.setName("party_msg").setDescription("Party message").setRequired(true))
        .addStringOption(option => option.setName("token").setDescription("Minecraft session token").setRequired(true))
        .addStringOption(option => option.setName("webhook").setDescription("Alert webhook").setRequired(true))
        .addStringOption(option => option.setName("type").setDescription("Type (lobby/skyblock)").setRequired(true));

    const statusCommand = new SlashCommandBuilder()
        .setName("list")
        .setDescription("List active bots")

    const deactivateCommand = new SlashCommandBuilder()
        .setName("deactivate")
        .setDescription("Deactivate a bot")
        .addStringOption(option => option.setName("username").setDescription("Bot username").setRequired(true))

    const rest = new REST({ version: '10' }).setToken(discordToken);
    await rest.put(
        Routes.applicationGuildCommands(clientId, guildId),
        { body: [activateCommand.toJSON(), statusCommand.toJSON(), deactivateCommand.toJSON()] },
    );
}

async function getProfile(token) {
    const res = await axios.get("https://api.minecraftservices.com/minecraft/profile", {
        headers: {
            "Authorization": `Bearer ${token}`
        }
    });

    return res.data;
}

async function createBot(token, profile, lobbyMessage, partyMessage, webhook, type, userId) {
    const { name, id } = profile;
    if (bots[name] != null) {
        bots[name].client.end();
        bots[name] = null;
    }

    const bot = mineflayer.createBot({
        host: "hypixel.net",
        port: 25565,
        version: "1.8.9",
        username: name,
        hideErrors: true,
        session: {
            accessToken: token,
            clientToken: id,
            selectedProfile: {
                id: id,
                name: name
            }
        },
        auth: "mojang",
        skipValidation: true
    });

    const hook = new WebhookClient({ url: webhook });
    const data = {
        client: bot,
        lobbyMsg: lobbyMessage,
        partyMsg: partyMessage,
        type: type,
        id: userId,
        alert: msg => {
            const embed = new EmbedBuilder()
                .setDescription(msg)
                .setColor("#58b9ff")

            hook.send({
                username: name,
                avatarURL: `https://crafatar.com/avatars/${id}`,
                embeds: [embed],
            });
        }
    };

    bot.once("login", () => {
        data.alert("Successfully joined Hypixel.")

        setTimeout(() => {
            bot.chat("/lobby")
        }, 1000);

        if (type == "skyblock") {
            setTimeout(() => {
                bot.chat("/skyblock")
            }, 1500);
        }

        setTimeout(() => {
            bot.chat("/hub")
        }, 3000);

        setTimeout(() => {
            bot.chat("/chat a")
        }, 3400);

        setTimeout(() => {
            bots[name] = data;
        }, 3500);
    });

    bot.on("kicked", msg => {
        data.alert(`Disconnected: ${msg}`)
        delete bots[name];
    });

    bot.on("error", err => {
        data.alert(`An error occured.`)
        console.log(err);
        delete bots[name];
    });

    bot.on("message", msg => {
        if (!msg) {
            return;
        }

        const chat = decodeChat(msg);
        console.log(`[${name}] ${chat}`);

        handleInvite(chat, bot, data.partyMsg, data.alert);
    });


    return bot;
}

function sendMessage(bot, spamMsg) {
    var msg = `${spamMsg}`;
    msg = replaceLetters(msg);

    bot.chat(msg);
}

function handleInvite(chat, client, spamMsg, alert) {
    if (chat.includes("has invited you to join their party!")) {
        var index = chat.indexOf("has invited");
        var tag = chat.slice(54, index);

        RANKS.forEach(str => {
            tag = tag.replace(str, "");
        });

        alert(`Invited to party by **${tag}**. The bot will spam the party message 3x then leave the party.`)

        setTimeout(() => {
            client.chat(`/p join ${tag}`);
        }, 500);

        setTimeout(() => {
            client.chat(`/pc ${spamMsg}`);
        }, 1000);

        setTimeout(() => {
            client.chat(`/pc ${spamMsg}`);
        }, 1500);

        setTimeout(() => {
            client.chat(`/pc ${spamMsg}`);
        }, 2000);

        setTimeout(() => {
            client.chat(`/p leave`);
        }, 2500);
    }
}

function decodeChat(msg) {
    var str = "";
    if (msg.text) {
        str += msg.text;
    }

    if (msg.extra) {
        msg.extra.forEach(a => {
            str += decodeChat(a);
        });
    }

    return str;
}

client.once(Events.ClientReady, async c => {
    console.log(`Ready! Logged in as ${c.user.tag}`);
    channel = await client.channels.fetch(channelId);
});

client.on(Events.MessageCreate, async message => {
    // if (message.author.bot) {
    //     return;
    // }

    // if (message.channelId == channelId) {
    //     message.delete();
    // }
});

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) {
        return;
    }

    if (interaction.commandName == "activate") {
        if (interaction.channelId != channelId) {
            interaction.reply({ content: "No permission", ephemeral: true });
            return;
        }

        var exists = false;
        Object.keys(bots).forEach(bot => {
            if (bot.id == interaction.member.id) {
                exists = true;
            }
        });

        if (exists) {
            const embed = new EmbedBuilder()
            .setColor("#58b9ff")
            .setDescription("You already have an active bot!")

            interaction.reply({embeds: [embed]});
            return;
        }

        await interaction.deferReply({
            ephemeral: true
        });

        const lobbyMessage = interaction.options.getString("lobby_msg");
        const partyMessage = interaction.options.getString("party_msg");
        const token = interaction.options.getString("token");
        const webhook = interaction.options.getString("webhook");
        const type = interaction.options.getString("type").toLowerCase();

        if (type != "lobby" && type != "skyblock") {
            const embed = new EmbedBuilder()
                .setColor("#58b9ff")
                .setDescription("Invalid type! Please use **lobby** or **skyblock**.");

            interaction.editReply({
                embeds: [embed],
                ephemeral: true
            });

            return;
        }

        var profile;
        var bot;

        try {
            profile = await getProfile(token);
            bot = await createBot(token, profile, lobbyMessage, partyMessage, webhook, type, interaction.member.id);
        } catch (e) {
            console.log(e);
            interaction.editReply("Unable to login to Hypixel with the specified access token. Please try again.");
            return;
        }

        const embed = new EmbedBuilder()
            .setColor("#58b9ff")
            .setTitle('AdBot Activated')
            .addFields(
                { name: 'Username', value: profile.name },
                { name: 'Lobby message', value: lobbyMessage },
                { name: 'Party message', value: partyMessage },
                { name: 'Session token', value: token },
            )
            .setFooter({
                text: "Fazz's AdBot for Hypixel"
            });

        interaction.editReply({
            embeds: [embed],
            ephemeral: true
        });
    }

    if (interaction.commandName == "list") {
        if (!interaction.member.permissionsIn(interaction.channel).has("ADMINISTRATOR")) {
            interaction.reply({ content: "No permission", ephemeral: true });
            return;
        }

        const embed = new EmbedBuilder()
            .setColor("#58b9ff")
            .setTitle('AdBot Status')
            .setFooter({
                text: "Fazz's AdBot for Hypixel"
            });

        Object.keys(bots).forEach(username => {
            const info = bots[username];
            embed.addFields({ name: username, value: `**Lobby:** ${info.lobbyMsg}\n**Party:** ${info.partyMsg}\n**User:** <@${info.id}>` });
        });

        interaction.reply({
            embeds: [embed],
            ephemeral: true
        });
    }

    if (interaction.commandName == "deactivate") {
        if (!interaction.member.permissionsIn(interaction.channel).has("ADMINISTRATOR")) {
            interaction.reply({ content: "No permission", ephemeral: true });
            return;
        }

        const username = interaction.options.getString("username");
        const embed = new EmbedBuilder();

        if (bots[username] == null) {
            embed.setColor("#58b9ff")
                .setDescription(`No active bot with username **${username}**. Please try again.`)
        } else {
            bots[username].alert(`The bot was deactivated.`)
            bots[username].client.end();
            delete bots[username];

            embed.setColor("#58b9ff")
                .setDescription(`Successfully deactivated bot **${username}**`);
        }

        interaction.reply({
            embeds: [embed],
            ephemeral: true
        });
    }
});

function replaceLetters(word) {
    newWord = ""
    for (let i = 0; i < word.length; i++) {
        const char = word[i];
        if (GREEK_LETTERS[char.toLowerCase()] != null && (Math.random() > 0.5)) {
            newWord += GREEK_LETTERS[char.toLowerCase()]
        } else {
            newWord += char;
        }
    }

    return newWord;
}

async function startDiscord() {
    await client.login(discordToken);
}

function runTask() {
    Object.keys(bots).forEach(name => {
        const bot = bots[name];
        if (!bot) {
            return;
        }

        if (bot.type == "lobby") {
            spamLobby(name, bot.lobbyMsg);
        } else if (bot.type == "skyblock") {
            spamSkyblock(name, bot.lobbyMsg);
        }
    });

    lobby = lobby + 1
    if (lobby > 18) {
        lobby = 1;
    }
}

function spamLobby(name, msg) {
    if (bots[name]) {
        const bot = bots[name];

        bot.client.setQuickBarSlot(8)
        bot.client.activateBlock(bot.client.blockAt(bot.client.entity.position.offset(0, -1, 0)))
        bot.client.once('windowOpen', (window) => {
            bot.client.simpleClick.leftMouse(lobby - 1)
        });

        setTimeout(() => {
            if (bots[name]) {
                sendMessage(bot.client, msg);
            }
        }, 1000);

        setTimeout(() => {
            if (bots[name]) {
                sendMessage(bot.client, msg);
            }
        }, 4100);

        setTimeout(() => {
            if (bots[name]) {
                sendMessage(bot.client, msg);
            }
        }, 7200);
    }
}

function spamSkyblock(name, msg) {
    if (bots[name]) {
        const bot = bots[name];

        setTimeout(() => {
            bot.client.chat("/warp dhub");
        }, 500);

        setTimeout(() => {
            sendMessage(bot.client, msg);
        }, 2000);

        setTimeout(() => {
            bot.client.chat("/hub");
        }, 3500);

        setTimeout(() => {
            sendMessage(bot.client, msg);
        }, 8500);
    }
}

async function start() {
    await registerCommand();
    await startDiscord();


    setInterval(runTask, 15000);
}

start();