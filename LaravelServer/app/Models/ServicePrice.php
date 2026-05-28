<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ServicePrice extends Model
{
    protected $fillable = [
        'name',
        'category',
        'tiers',
        'effective_date',
        'image_path',
    ];

    protected $casts = [
        'tiers' => 'array',
        'effective_date' => 'date',
    ];

    protected $hidden = [
        'image_path',
    ];

    protected $appends = [
        'image_url',
    ];

    public function getImageUrlAttribute(): ?string
    {
        if (! $this->image_path) {
            return null;
        }

        $relative = '/api/service-price-images/'.ltrim(str_replace('\\', '/', $this->image_path), '/');

        // Render / production: set APP_URL to your public https://… origin so URLs never depend on proxy quirks.
        $configured = rtrim((string) config('app.url'), '/');
        if ($configured !== '' && ! str_contains($configured, 'localhost') && ! str_contains($configured, '127.0.0.1')) {
            return $configured.$relative;
        }

        if (function_exists('request') && request() && request()->getHttpHost()) {
            return request()->getSchemeAndHttpHost().$relative;
        }

        return $relative;
    }
}
