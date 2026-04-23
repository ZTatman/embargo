from fastapi import FastAPI

from app.routers import links

app = FastAPI(title="Myst")

app.include_router(links.router)


@app.get("/")
async def root():
    return {"message": "Welcome to Myst"}
