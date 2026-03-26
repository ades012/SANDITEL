package main

import (
	"auth-service/internal/delivery/http"
	"auth-service/internal/domain"
	"auth-service/internal/repository"
	"auth-service/internal/usecase"
	"log"

	"github.com/gin-gonic/gin"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func main() {
	// 1. Connect ke DB (Nanti ganti string ini pakai environment variable)
	dsn := "host=localhost user=postgres password=root dbname=auth_db port=5432 sslmode=disable"
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}

	// Auto-migrate schema (Buat test awal, di production mending pakai migration tools)
	db.AutoMigrate(&domain.Role{}, &domain.User{})

	// 2. Setup Layer
	repo := repository.NewAuthRepository(db)
	// Hardcode JWT secret buat sekarang. Wajib ganti pakai env.
	usecaseLayer := usecase.NewAuthUsecase(repo, "SUPER_SECRET_KEY_123") 

	// 3. Setup Router Gin
	r := gin.Default()
	http.NewAuthHandler(r, usecaseLayer)

	// 4. Jalankan Server
	log.Println("Auth Service running on port 8080...")
	r.Run(":8080")
}