package repository

import (
	"auth-service/internal/domain"
	"gorm.io/gorm"
)

type AuthRepository struct {
	DB *gorm.DB
}

func NewAuthRepository(db *gorm.DB) *AuthRepository {
	return &AuthRepository{DB: db}
}

func (r *AuthRepository) GetUserByUsername(username string) (*domain.User, error) {
	var user domain.User
	// Preload "Role" biar data role-nya ikut ke-query
	err := r.DB.Preload("Role").Where("username = ?", username).First(&user).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}