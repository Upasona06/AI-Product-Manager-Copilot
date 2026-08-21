"""
routes/auth_routes.py — Flask authentication routing
"""

import uuid
from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
import bcrypt

from database.db import db
from models.user import User

auth_bp = Blueprint("auth_bp", __name__)

@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json() or {}
    email = data.get("email")
    password = data.get("password")
    role = data.get("role")
    full_name = data.get("full_name")
    project_id_str = data.get("project_id")
    
    if not email or not password or not role:
        return jsonify({
            "success": False,
            "error": "Missing required fields: email, password, and role are required."
        }), 400
        
    if role not in ("product_manager", "customer"):
        return jsonify({
            "success": False,
            "error": "Invalid role. Role must be 'product_manager' or 'customer'."
        }), 400
        
    try:
        # Check if user already exists
        existing_user = User.query.filter_by(email=email).first()
        if existing_user:
            return jsonify({
                "success": False,
                "error": "Email is already registered."
            }), 409
            
        # Hash password using bcrypt
        password_bytes = password.encode('utf-8')
        salt = bcrypt.gensalt()
        hashed_password = bcrypt.hashpw(password_bytes, salt).decode('utf-8')
        
        # Default project ID — all users share this project for single-tenant testing
        DEFAULT_PROJECT_ID = uuid.UUID("550e8400-e29b-41d4-a716-446655440000")

        # Customers are ALWAYS assigned to the default project regardless of input.
        # PMs may optionally specify a custom project_id; if not provided, use default.
        if role == "customer":
            project_uuid = DEFAULT_PROJECT_ID
        else:
            # product_manager
            if project_id_str and project_id_str.strip():
                try:
                    project_uuid = uuid.UUID(project_id_str.strip())
                except ValueError:
                    return jsonify({
                        "success": False,
                        "error": "Invalid project_id format. Must be a valid UUID."
                    }), 400
            else:
                project_uuid = DEFAULT_PROJECT_ID
                
        new_user = User(
            email=email,
            password_hash=hashed_password,
            full_name=full_name,
            role=role,
            project_id=project_uuid,
            is_active=True
        )
        db.session.add(new_user)
        db.session.commit()
        
        return jsonify({
            "success": True,
            "data": {
                "user_id": str(new_user.user_id),
                "message": "Registration successful"
            }
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({
            "success": False,
            "error": f"An error occurred during registration: {str(e)}"
        }), 500


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    email = data.get("email")
    password = data.get("password")
    
    if not email or not password:
        return jsonify({
            "success": False,
            "error": "Missing email or password."
        }), 400
        
    user = User.query.filter_by(email=email, is_active=True).first()
    if not user:
        return jsonify({
            "success": False,
            "error": "Invalid credentials."
        }), 401
        
    # Verify password
    password_bytes = password.encode('utf-8')
    hash_bytes = user.password_hash.encode('utf-8')
    
    if not bcrypt.checkpw(password_bytes, hash_bytes):
        return jsonify({
            "success": False,
            "error": "Invalid credentials."
        }), 401
        
    # Update last_login_at
    from datetime import datetime, timezone
    try:
        user.last_login_at = datetime.now(timezone.utc)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        print(f"Failed to update last login timestamp: {e}")
        
    # Generate JWT Token with claims
    additional_claims = {
        "role": user.role,
        "email": user.email,
        "project_id": str(user.project_id) if user.project_id else None,
        "full_name": user.full_name
    }
    
    access_token = create_access_token(
        identity=str(user.user_id),
        additional_claims=additional_claims
    )
    
    return jsonify({
        "success": True,
        "data": {
            "access_token": access_token,
            "user_id": str(user.user_id),
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
            "project_id": str(user.project_id) if user.project_id else None
        }
    }), 200


@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def me():
    user_id = get_jwt_identity()
    user = User.query.get(uuid.UUID(user_id))
    if not user or not user.is_active:
        return jsonify({
            "success": False,
            "error": "User not found or inactive."
        }), 404
        
    return jsonify({
        "success": True,
        "data": user.to_dict()
    }), 200


@auth_bp.route("/change-password", methods=["POST"])
@jwt_required()
def change_password():
    user_id = get_jwt_identity()
    user = User.query.get(uuid.UUID(user_id))
    if not user or not user.is_active:
        return jsonify({
            "success": False,
            "error": "User not found or inactive."
        }), 404
        
    data = request.get_json() or {}
    current_password = data.get("current_password")
    new_password = data.get("new_password")
    
    if not current_password or not new_password:
        return jsonify({
            "success": False,
            "error": "Current password and new password are required."
        }), 400
        
    # Verify current password
    current_bytes = current_password.encode('utf-8')
    hash_bytes = user.password_hash.encode('utf-8')
    if not bcrypt.checkpw(current_bytes, hash_bytes):
        return jsonify({
            "success": False,
            "error": "Incorrect current password."
        }), 401
        
    # Hash new password
    new_bytes = new_password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed_password = bcrypt.hashpw(new_bytes, salt).decode('utf-8')
    
    try:
        user.password_hash = hashed_password
        db.session.commit()
        return jsonify({
            "success": True,
            "message": "Password updated successfully."
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({
            "success": False,
            "error": f"An error occurred: {str(e)}"
        }), 500


@auth_bp.route("/workspace", methods=["GET"])
@jwt_required()
def get_workspace_info():
    """Returns workspace/project statistics, user counts, and member list."""
    from models.raw_feedback import RawFeedback

    user_id = get_jwt_identity()
    user = User.query.get(uuid.UUID(user_id))
    if not user or not user.is_active:
        return jsonify({
            "success": False,
            "error": "User not found or inactive."
        }), 404

    project_uuid = user.project_id
    if not project_uuid:
        return jsonify({
            "success": True,
            "data": {
                "project_id": None,
                "total_members": 0,
                "pm_count": 0,
                "customer_count": 0,
                "total_feedback": 0,
                "members": []
            }
        }), 200

    # Query all users in this workspace
    workspace_users = User.query.filter_by(project_id=project_uuid, is_active=True).all()
    
    pm_count = sum(1 for u in workspace_users if u.role == "product_manager")
    customer_count = sum(1 for u in workspace_users if u.role == "customer")
    
    # Query total feedback count in this workspace
    total_feedback = RawFeedback.query.filter_by(project_id=project_uuid).count()

    members = [
        {
            "user_id": str(u.user_id),
            "full_name": u.full_name or "Anonymous",
            "email": u.email,
            "role": u.role,
            "created_at": u.created_at.isoformat() if hasattr(u, 'created_at') and u.created_at else None
        }
        for u in workspace_users
    ]

    return jsonify({
        "success": True,
        "data": {
            "project_id": str(project_uuid),
            "total_members": len(workspace_users),
            "pm_count": pm_count,
            "customer_count": customer_count,
            "total_feedback": total_feedback,
            "members": members
        }
    }), 200

