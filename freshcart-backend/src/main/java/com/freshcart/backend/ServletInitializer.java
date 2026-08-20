package com.freshcart.backend;

import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.boot.web.servlet.support.SpringBootServletInitializer;

/**
 * Entry point Tomcat uses when the app is deployed as a WAR file.
 * Without this class, an external Tomcat has no way to start the
 * Spring Boot application context (only "mvn spring-boot:run" / the
 * fat executable jar would work).
 */
public class ServletInitializer extends SpringBootServletInitializer {

    @Override
    protected SpringApplicationBuilder configure(SpringApplicationBuilder application) {
        return application.sources(FreshcartBackendApplication.class);
    }
}
