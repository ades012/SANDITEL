package domain

import (
	"time"
	"github.com/golang-jwt/jwt/v5"
)

type PortalType string

const (
	WarehousePortal PortalType = "warehouse_portal"
	AdminPortal     PortalType = "admin_portal"
)

type Role struct {
	ID             uint       `gorm:"primaryKey"`
	Name           string     `gorm:"unique;not null"`
	AssignedPortal PortalType `gorm:"not null"`
}

type User struct {
	ID           string    `gorm:"type:uuid;default:gen_random_uuid();primaryKey"`
	Username     string    `gorm:"unique;not null"`
	Email        string    `gorm:"unique;not null"`
	PasswordHash string    `gorm:"not null"`
	RoleID       uint      `gorm:"not null"`
	Role         Role      `gorm:"foreignKey:RoleID"`
	IsActive     bool      `gorm:"default:true"`
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

// Custom JWT Claims
type AuthCustomClaims struct {
	UserID string     `json:"user_id"`
	Role   string     `json:"role"`
	Portal PortalType `json:"portal"`
	jwt.RegisteredClaims
}