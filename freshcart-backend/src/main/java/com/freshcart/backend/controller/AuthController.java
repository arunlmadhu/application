package com.freshcart.backend.controller;

import com.freshcart.backend.dto.AuthResponse;
import com.freshcart.backend.dto.LoginRequest;
import com.freshcart.backend.dto.RegisterRequest;
import com.freshcart.backend.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    // Customer self-registration. Admin accounts are seeded/managed separately -
    // never let this endpoint create admin users.
    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(authService.register(request));
    }

    // Single login endpoint for both customers and admins - the role in the
    // response/JWT comes from the database, not from anything the client sends.
    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest request) {
        return authService.login(request);
    }
}
