package main

import (
	"log"
	"net/http"
	"os"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"

	"github.com/axell/Coloc3G/swarm-manager/backend/pkg/infra"
	"github.com/axell/Coloc3G/swarm-manager/backend/pkg/transport"
)

func main() {
	// Initialize Docker client
	dockerClient, err := infra.NewDockerClient()
	if err != nil {
		log.Fatalf("failed to create docker client: %v", err)
	}

	// Start Echo
	e := echo.New()
	e.HideBanner = true
	// Structured request logging
	e.Use(middleware.LoggerWithConfig(middleware.LoggerConfig{
		Format: "[${time_rfc3339}] ${method} ${uri} ${status} ${latency_human}\n",
	}))
	// Recover from panics
	e.Use(middleware.Recover())

	// Global HTTP error handler: log and return structured JSON
	e.HTTPErrorHandler = func(err error, c echo.Context) {
		// Determine status code
		code := http.StatusInternalServerError
		msg := err.Error()
		if he, ok := err.(*echo.HTTPError); ok {
			code = he.Code
			if m, ok2 := he.Message.(string); ok2 {
				msg = m
			}
		}
		// Log error with request details
		c.Logger().Errorf("Request %s %s -> error: %s", c.Request().Method, c.Request().URL, msg)
		// Send JSON error response
		if !c.Response().Committed {
			c.JSON(code, map[string]string{"error": msg})
		}
	}

	// Handlers
	h := transport.NewHandler(dockerClient)

	// Routes
	g := e.Group("/api")
	g.GET("/nodes", h.ListNodes)
	g.GET("/stacks", h.ListStacks)
	g.GET("/stacks/:name", h.GetStack)
	g.POST("/stacks/:name/stop", h.StopStack)
	g.POST("/stacks/:name/start", h.StartStack)
	g.GET("/images", h.ListImages)
	g.POST("/images/:id/remove", h.RemoveImage)
	g.POST("/services/:id/stop", h.StopService)
	g.POST("/services/:id/restart", h.RestartService)
	g.GET("/services/:id/logs", h.ServiceLogs)
	g.POST("/nodes/:id/drain", h.DrainNode)
	g.POST("/nodes/:id/activate", h.ActivateNode)

	// Configuration améliorée pour servir une application React/Vite

	e.Use(middleware.StaticWithConfig(middleware.StaticConfig{
		Skipper: nil,
		// Root directory from where the static content is served.
		Root: "static",
		// Index file for serving a directory.
		// Optional. Default value "index.html".
		Index: "index.html",
		// Enable HTML5 mode by forwarding all not-found requests to root so that
		// SPA (single-page application) can handle the routing.
		HTML5:      true,
		Browse:     false,
		IgnoreBase: false,
		Filesystem: nil,
	}))

	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "5000"
	}
	e.Logger.Fatal(e.Start("0.0.0.0:" + port))
}
