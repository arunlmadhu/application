package com.freshcart.backend.dto;

import com.freshcart.backend.entity.Product;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProductResponse {
    private Long id;
    private String name;
    private String category;
    private BigDecimal price;
    private String unit;
    private Integer stock;
    private String emoji;

    public static ProductResponse from(Product p) {
        return ProductResponse.builder()
                .id(p.getId())
                .name(p.getName())
                .category(p.getCategory())
                .price(p.getPrice())
                .unit(p.getUnit())
                .stock(p.getStock())
                .emoji(p.getEmoji())
                .build();
    }
}
