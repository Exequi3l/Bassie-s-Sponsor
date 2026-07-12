import discord
from discord.ext import commands
import requests

# Asegúrate de tener definidos tu BOT y la API KEY de Bloxlink
# bot = commands.Bot(command_prefix="!")
# BLOXLINK_API_KEY = "8fe9f751-9316-4fe1-82f7-2438e97db65a"

@bot.command(name="search")
async def search(ctx, usuario_discord: discord.User):
    url = f"https://api.bloxlink.biz/v3/user/{usuario_discord.id}"
    headers = {"Authorization": BLOXLINK_API_KEY}
    
    # Realiza la petición a la API de Bloxlink
    response = requests.get(url, headers=headers)
    
    if response.status_code == 200:
        datos = response.json()
        roblox_id = datos.get("robloxId", "No encontrado")
        
        # Crear el Embed decorado
        embed = discord.Embed(
            title=f"{usuario_discord.display_name} [{usuario_discord.id}]",
            color=discord.Color.blue()
        )
        
        # Cuerpo del mensaje estructurado
        embed.add_field(
            name="Users Connected:",
            value=f"{usuario_discord.mention} [{roblox_id}]",
            inline=False
        )
        
        await ctx.send(embed=embed)
        
    else:
        # Embed con el mensaje de error solicitado
        embed_error = discord.Embed(
            description="❌ Users not founded / doesnt exists",
            color=discord.Color.red()
        )
        await ctx.send(embed=embed_error)
