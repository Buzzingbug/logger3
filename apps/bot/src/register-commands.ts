import { REST, Routes, SlashCommandBuilder } from "discord.js";
import { botConfig } from "./config.js";

const commands = [
  new SlashCommandBuilder().setName("ping").setDescription("Check bot latency"),
  new SlashCommandBuilder().setName("dashboard").setDescription("Open the web dashboard"),
  new SlashCommandBuilder().setName("config").setDescription("View logger configuration"),
  new SlashCommandBuilder().setName("debug").setDescription("Run server diagnostics")
].map((command) => command.toJSON());

const rest = new REST({ version: "10" }).setToken(botConfig.token());
await rest.put(Routes.applicationCommands(botConfig.clientId()), { body: commands });
console.log(`Registered ${commands.length} global commands`);
