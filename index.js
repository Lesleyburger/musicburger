require('dotenv').config()

const { Client, Util } = require ('discord.js')
const discord = require('discord.js')
const ytdl = require('ytdl-core')
const Youtube = require('simple-youtube-api')
const { getURLVideoID } = require('ytdl-core')
const PREFIX = '*'

const client = new Client({ disableEveryone: true })

const youtube = new Youtube(process.env.GOOGLE_API_KEY)

const queue = new Map()

client.on("ready", async () => {

    console.log(`${client.user.username} is online!`);
    client.user.setActivity("Your favorite music", {type: "PLAYING"});
});

client.on('message', async message => {
    if(message.author.bot) return
    if(!message.content.startsWith(PREFIX)) return

    const args = message.content.substring(PREFIX.length).split(" ")
    const searchString = args.slice(1).join(' ')
    const url = args[1] ? args[1].replace(/<(.+)>/g, '$1') : ''
    const serverQueue = queue.get(message.guild.id)

    if(message.content.startsWith(`${PREFIX}play`)) {
        const voiceChannel = message.member.voice.channel
        if(!voiceChannel) return message.channel.send("you need to be in a voice channel to play music")
        const permissions = voiceChannel.permissionsFor(message.client.user)
        if(!permissions.has('CONNECT')) return message.channel.send("i dont have permission to connect to the voice channel")
        if(!permissions.has('SPEAK')) return message.channel.send("I don't have permissions to speak in the channel")

        if(url.match(/https?:\/\/(www.youtube.com|youtube.com)\/playlist(.*)$/)) {
            const playlist = await youtube.getPlaylist(url)
            const videos = await playlist.getVideos()
            for (const video of Object.values(videos)) {
                const video2 = await youtube.getVideoByID(video.id)
                await handleVideo(video2, message, voiceChannel, true)
            }
            message.channel.send(`Playlist: **${playList.title}** has been added to the queue`)
            return undefined
        } else {
            try {
                var video = await youtube.getVideoByID(url);
              } catch {
                try {
                  var videos = await youtube.searchVideos(searchString, 1);
                  var video = await youtube.getVideoByID(videos[0].id);
                } catch (error) {
                  console.log(error);
                  return message.channel.send("I couln't find song with that title.");
                }
              }
            return handleVideo(video, message, voiceChannel)
        }
    } else if (message.content.startsWith(`${PREFIX}stop`)) {
        if(!message.member.voice.channel) return message.channel.send("You need to be in a voice channel to stop the music")
        if(!serverQueue) return message.channel.send("There is nothing playing")
        serverQueue.songs = []
        serverQueue.connection.dispatcher.end()
        var stopEmbed = new discord.MessageEmbed()
        .setColor("RANDOM")
        .addField("__**I HAVE STOPPED THE MUSIC FOR YOU**__" `${song.title}` )
        return message.channel.send(stopEmbed);
        return undefined
    } else if (message.content.startsWith(`${PREFIX}skip`)) {
        if(!message.member.voice.channel) return message.channel.send("You need to be in a voice channel to skip the music")
        if(!serverQueue) return message.channel.send("There is nothing playing")
        serverQueue.connection.dispatcher.end()
        var skipEmbed = new discord.MessageEmbed()
        .setColor("RANDOM")
        .addField("__**YOU SKIPPED THIS SONG:**__" `${song.title}` )
        return message.channel.send(skipEmbed);
        return undefined
    } else if (message.content.startsWith(`${PREFIX}volume`)) {
        if(!message.member.voice.channel) return message.channel.send("You need to be in a voice channel to use music commands")
        if(!serverQueue) return message.channel.send("There is nothing playing")
        if(!args[1]) return message.channel.send(`That volume is: **${serverQueue.volume}**`)
        if(isNaN(args[1])) return message.channel.send("That is not a valid amount to change the volume")
        serverQueue.volume = args[1]
        serverQueue.connection.dispatcher.setVolumeLogarithmic(args[1] / 5) 
        var volumeEmbed = new discord.MessageEmbed()
        .setColor("RANDOM")
        .addField("__**THE VOLUME GOT CHANGED TO:**__" `**${args[1]}**`)
        return message.channel.send(volumeEmbed);
        return undefined
    } else if (message.content.startsWith(`${PREFIX}np`)) {
        if(!serverQueue) return message.channel.send("There is nothing playing")
        var npEmbed = new discord.MessageEmbed()
        .setColor("RANDOM")
        .addField("__**NOW PLAYING:**__" `${serverQueue.songs[0].title}` )
        return message.channel.send(npEmbed);
        return undefined
    } else if (message.content.startsWith(`${PREFIX}queue`)) {
        if(!serverQueue) return message.channel.send("There is nothing playing")
        var botEmbed = new discord.MessageEmbed()
        .setDescription("__**QUEUED SONGS**__")
        .setColor("RANDOM")
        .addField("__**Playing in**__", message.guild.member(client.user).voice.channel)
        .addField("__**Song Queue**__", `
        ${serverQueue.songs.map(song => `**-** ${song.title}`).join('\n')}`)
        .addField("__**Now Playing:**__", `${serverQueue.songs[0].title}`, { split: true })
        return message.channel.send(botEmbed);
        return undefined
    } else if (message.content.startsWith(`${PREFIX}pause`)) {
        if(!message.member.voice.channel) return message.channel.send("You need to be in a voice channel to use the pause command")
        if(!serverQueue) return message.channel.send("There is nothing playing")
        if(!serverQueue.playing) return message.channel.send("The music is already paused")
        serverQueue.playing = false
        serverQueue.connection.dispatcher.pause()
        var pauseEmbed = new discord.MessageEmbed()
        .setColor("RANDOM")
        .addField("__**YOUR SONG HAS BEEN PAUSED**__" `${song.title}` )
        return message.channel.send(pauseEmbed);
        return undefined
    } else if (message.content.startsWith(prefix + "resume")) {
            if (!message.member.voice.channel)
              return message.channel.send("Please join voice channel first.");
            if (!message.member.hasPermission("ADMINISTRATOR"))
              return message.channel.send("Only adiminstarators can resume music.");
            if (!serverQueue) return message.channel.send("There is nothing playing.");
            if (serverQueue.playing)
              return message.channel.send("The music is already playing.");
            serverQueue.playing = true;
            serverQueue.connection.dispatcher.resume();
            var resumeEmbed = new discord.MessageEmbed()
        .setColor("RANDOM")
        .addField("YOUR SONG HAS BEEN RESUMED" `${song.title}` )
        return message.channel.send(resumeEmbed);
        return undefined
    }
    return undefined
})

async function handleVideo(video, message, voiceChannel, playList = false) {
    const serverQueue = queue.get(message.guild.id)

    const song = {
        id: video.id,
        title: Util.escapeMarkdown(video.title),
        url: `https://www.youtube.com/watch?v=${video.id}`
    }

    if(!serverQueue) {
        const queueConstruct = {
            textChannel: message.channel,
            voiceChannel: voiceChannel,
            connection: null,
            songs: [],
            volume: 5,
            playing: true
        }
        queue.set(message.guild.id, queueConstruct)

        queueConstruct.songs.push(song)

        try {
            var connection = await voiceChannel.join()
            queueConstruct.connection = connection
            play(message.guild, queueConstruct.songs[0])
        } catch (error) {
            console.log(`there was an error connecting to the voice channel: ${error}`)
            queue.delete(message.guild.id)
            message.channel.send(`There was an error connecting to the voice channel: ${error}`)
        }
    } else {
        serverQueue.songs.push(song)
        if(playList) return undefined
        else return message.channel.send(`**${song.title}** has been added to the queue`)
    }
    return undefined
}

function play(guild, song) {
    const serverQueue = queue.get(guild.id)

    if(!song) {
        serverQueue.voiceChannel.leave()
        queue.delete(guild.id)
        return
    }

    const dispatcher = serverQueue.connection.play(ytdl(song.url))
    .on('finish', () => {
        serverQueue.songs.shift()
        play(guild, serverQueue.songs[0])
    })
    .on('error', error => {
        console.log(error)
    })
    dispatcher.setVolumeLogarithmic(serverQueue.volume / 5)

    var playingEmbed = new discord.MessageEmbed()
    .setColor("RANDOM")
    .addField("__**Song added**__", `${song.title}`)
    .setTimestamp()

    return serverQueue.textChannel.send(playingEmbed)

}

client.login(process.env.TOKEN)