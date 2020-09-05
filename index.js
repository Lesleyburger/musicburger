const { Client } = require('discord.js')
  const ytdl = require('ytdl-core')
  const Discord = require('discord.js')
  const YouTube = require('simple-youtube-api')
  const prefix = '*'
  
  const client = new Client({
    disableEveryone: true
  })
  
  const youtube = new YouTube(process.env.GOOGLE_API_KEY)
  
  const queue = new Map()
  
  client.on('ready', () => console.log('Active'))
  client.on("message", async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith(prefix)) return;
  
    const args = message.content.substring(prefix.length).split(" ");
    const searchString = args.slice(1).join(" ");
    const url = args[1] ? args[1].replace(/<(.+)>/g, "$1") : "";
    const serverQueue = queue.get(message.guild.id);
  
    if (message.content.startsWith(prefix + "play")) {
      const voiceChannel = message.member.voice.channel;
      if (!voiceChannel)
        return message.channel.send("Please join a voice channel first.");
      const permissions = voiceChannel.permissionsFor(message.client.user);
      if (!permissions.has("CONNECT"))
        return message.channel.send(
          "I don't have permissions to connect to voice channel."
        );
      if (!permissions.has("SPEAK"))
        return message.channel.send(
          "I don't have permissions to speak in the voice channel."
        );
  
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
  
      const song = {
        id: video.id,
        title: Discord.Util.escapeMarkdown(video.title),
        url: `https://www.youtube.com/watch?v=${video.id}`,
      };
  
      if (!serverQueue) {
        const queueConstruct = {
          textChannel: message.channel,
          voiceChannel: voiceChannel,
          connection: null,
          songs: [],
          volume: 5,
          playing: true,
        };
        queue.set(message.guild.id, queueConstruct);
  
        queueConstruct.songs.push(song);
  
        try {
          var connection = await voiceChannel.join();
          queueConstruct.connection = connection;
          play(message.guild, queueConstruct.songs[0]);
        } catch (err) {
          console.log(
            `There was an error while connectiong to voice channel: ${err}`
          );
          queue.delete(message.guild.id);
          message.channel.send(
            `There was an error while connectiong to voice channel: ${err}`
          );
        }
      } else {
        serverQueue.songs.push(song);
        return message.channel.send(
          `Succesfully added **${song.title}** to the queue.`
        );
      }
      return undefined;
    } else if (message.content.startsWith(prefix + "stop")) {
      if (!message.member.voice.channel)
        return message.channel.send("Join a voice channel to stop music.");
      if (!serverQueue) return message.channel.send("There is nothing in the queue.");
      serverQueue.songs = [];
      serverQueue.connection.dispatcher.end();
      return message.channel.send("I have stoped the music.");
    } else if (message.content.startsWith(prefix + "skip")) {
      if (!message.member.voice.channel)
        return message.channel.send("You need to join a voice channel first.");
      if (!message.member.hasPermission("ADMINISTRATOR"))
        return message.channel.send(
          "Only server administartors can skip the music."
        );
      if (!serverQueue) return message.channel.send("There is nothing playing.");
      serverQueue.connection.dispatcher.end();
      return message.channel.send("I have skipped the music.");
    } else if (message.content.startsWith(prefix + "volume")) {
      if (!message.member.voice.channel)
        return message.channel.send("Please join voice channel first.");
      if (!message.member.hasPermission("ADMINISTRATOR"))
        return message.channel.send("Only adiminstarators can change volume.");
      if (!serverQueue) return message.channel.send("There is nothing playing.");
      if (!args[1])
        return message.channel.send(`Volume is still: **${serverQueue.volume}**`);
      if (isNaN(args[1]))
        return message.channel.send(`Can not set volume to letters.`);
      serverQueue.volume = args[1];
      serverQueue.connection.dispatcher.setVolumeLogarithmic(args[1] / 5);
      return message.channel.send(`Volume is now **${args[1]}**`);
    } else if (message.content.startsWith(prefix + "np")) {
      if (!serverQueue) return message.channel.send("There is nothing playing.");
      return message.channel.send(
        `Now playing: **${serverQueue.songs[0].title}**`
      );
    } else if (message.content.startsWith(prefix + "queue")) {
      if (!serverQueue) return message.channel.send("There is nothing in queue.");
      return message.channel.send(
        `
            __**Song Queue:**__
            ${serverQueue.songs.map((song) => `**-** ${song.title}`).join("\n")}
    
        __**Now Playing:**__ ${serverQueue.songs[0].title}
            `, {
          split: true
        }
      );
    } else if (message.content.startsWith(prefix + "pause")) {
      if (!message.member.voice.channel)
        return message.channel.send("Please join voice channel first.");
      if (!message.member.hasPermission("ADMINISTRATOR"))
        return message.channel.send("Only adiminstarators can pause music.");
      if (!serverQueue) return message.channel.send("There is nothing playing.");
      if (!serverQueue.playing)
        return message.channel.send("The music is already paused.");
      serverQueue.playing = false;
      serverQueue.connection.dispatcher.pause();
      return message.channel.send("I have paused the music.");
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
      return message.channel.send("I have resumed the music.");
    }
  
  });
  
  function play(guild, song) {
    const serverQueue = queue.get(guild.id);
  
    if (!song) {
      serverQueue.voiceChannel.leave();
      queue.delete(guild.id);
      return;
    }
  
    const dispatcher = serverQueue.connection
      .play(ytdl(song.url))
      .on("finish", () => {
        serverQueue.songs.shift();
        play(guild, serverQueue.songs[0]);
      })
      .on("error", (error) => {
        console.log(error);
      });
    dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);
  
    serverQueue.textChannel.send(`Started playing: **${song.title}**`);
  }
  
  client.login(process.env.token)