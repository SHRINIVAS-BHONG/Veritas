from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from starlette.responses import RedirectResponse

from src.api.dependencies import get_db
from src.core.security import oauth, create_access_token
from src.models.user_model import User

router = APIRouter()

@router.get("/login/github")
async def login_via_github(request: Request):
    # This URL should be the callback endpoint configured in GitHub OAuth App
    redirect_uri = request.url_for('auth_github_callback')
    return await oauth.github.authorize_redirect(request, redirect_uri)

@router.get("/callback/github", name="auth_github_callback")
async def auth_github_callback(request: Request, db: AsyncSession = Depends(get_db)):
    token = await oauth.github.authorize_access_token(request)
    resp = await oauth.github.get('user', token=token)
    profile = resp.json()
    
    github_id = str(profile.get("id"))
    email = profile.get("email") or f"{profile.get('login')}@github.com"
    full_name = profile.get("name") or profile.get("login")
    
    # Check if user exists
    result = await db.execute(select(User).where(User.github_id == github_id))
    user = result.scalars().first()
    
    if not user:
        # Create new user
        user = User(
            email=email,
            hashed_password="oauth_managed", # No password needed for OAuth
            full_name=full_name,
            github_id=github_id
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        
    # Generate JWT
    access_token = create_access_token(subject=user.id)
    
    # In a real app, redirect to frontend with token, e.g. /dashboard?token={access_token}
    return {"access_token": access_token, "token_type": "bearer"}
