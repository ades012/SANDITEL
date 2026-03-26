package usecase

import (
	"auth-service/internal/domain"
	"auth-service/internal/repository"
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

type AuthUsecase struct {
	Repo      *repository.AuthRepository
	JWTSecret []byte
}

func NewAuthUsecase(repo *repository.AuthRepository, secret string) *AuthUsecase {
	return &AuthUsecase{
		Repo:      repo,
		JWTSecret: []byte(secret),
	}
}

func (u *AuthUsecase) Authenticate(username, password string, expectedPortal domain.PortalType) (string, error) {
	// 1. Cari user di DB
	user, err := u.Repo.GetUserByUsername(username)
	if err != nil {
		return "", errors.New("invalid credentials")
	}

	// 2. Cek password hash
	err = bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password))
	if err != nil {
		return "", errors.New("invalid credentials")
	}

	// 3. Validasi Portal Access (Ini yang lu minta biar login A dan B kepisah)
	if user.Role.AssignedPortal != expectedPortal {
		return "", errors.New("unauthorized portal access")
	}

	// 4. Generate JWT
	claims := domain.AuthCustomClaims{
		UserID: user.ID,
		Role:   user.Role.Name,
		Portal: user.Role.AssignedPortal,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString(u.JWTSecret)
	if err != nil {
		return "", errors.New("failed to generate token")
	}

	return tokenString, nil
}