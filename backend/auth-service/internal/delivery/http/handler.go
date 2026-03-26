package http

import (
	"auth-service/internal/domain"
	"auth-service/internal/usecase"
	"net/http"

	"github.com/gin-gonic/gin"
)

type AuthHandler struct {
	Usecase *usecase.AuthUsecase
}

func NewAuthHandler(route *gin.Engine, u *usecase.AuthUsecase) {
	handler := &AuthHandler{Usecase: u}

	// Route dipisah sesuai portal
	route.POST("/api/v1/auth/login/warehouse", handler.LoginWarehouse)
	route.POST("/api/v1/auth/login/staff", handler.LoginStaff)
}

type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

func (h *AuthHandler) LoginWarehouse(c *gin.Context) {
	h.processLogin(c, domain.WarehousePortal)
}

func (h *AuthHandler) LoginStaff(c *gin.Context) {
	h.processLogin(c, domain.AdminPortal)
}

func (h *AuthHandler) processLogin(c *gin.Context, portal domain.PortalType) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	token, err := h.Usecase.Authenticate(req.Username, req.Password, portal)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Login successful",
		"token":   token,
	})
}