<?php
if (!defined('ABSPATH')) {
    exit;
}

/**
 * REST API do Plugin Turmas de Pilates
 *
 * Endpoints:
 *  GET /wp-json/turmas/v1/estados
 *  GET /wp-json/turmas/v1/cidades?estado_id=XX  OU  ?estado_slug=sp
 *  GET /wp-json/turmas/v1/turmas?cidade_id=POST_ID
 */

add_action('rest_api_init', function () {

    // 1) Estados (somente os que têm turmas)
    register_rest_route('turmas/v1', '/estados', [
        'methods'  => 'GET',
        'callback' => 'turmas_rest_get_estados',
        'permission_callback' => '__return_true',
    ]);

    // 2) Cidades por estado
    register_rest_route('turmas/v1', '/cidades', [
        'methods'  => 'GET',
        'callback' => 'turmas_rest_get_cidades',
        'permission_callback' => '__return_true',
        'args' => [
            'estado_id' => [
                'required' => false,
                'validate_callback' => function ($param) {
                    return is_numeric($param) && intval($param) > 0;
                }
            ],
            'estado_slug' => [
                'required' => false,
                'sanitize_callback' => 'sanitize_title',
            ],
        ],
    ]);

    // 3) Turmas de uma cidade (post_type=turma)
    register_rest_route('turmas/v1', '/turmas', [
        'methods'  => 'GET',
        'callback' => 'turmas_rest_get_turmas',
        'permission_callback' => '__return_true',
        'args' => [
            'cidade_id' => [
                'required' => true,
                'validate_callback' => function ($param) {
                    return is_numeric($param) && intval($param) > 0;
                }
            ],
        ],
    ]);
});

/**
 * GET /estados
 */
function turmas_rest_get_estados(WP_REST_Request $request) {
    $terms = get_terms([
        'taxonomy'   => 'estado',
        'hide_empty' => true, // só estados ligados a posts
        'orderby'    => 'name',
        'order'      => 'ASC',
    ]);

    if (is_wp_error($terms)) {
        return new WP_REST_Response([
            'error' => true,
            'message' => $terms->get_error_message(),
        ], 500);
    }

    $out = [];
    foreach ($terms as $t) {
        $out[] = [
            'id'    => (int) $t->term_id,
            'name'  => $t->name,
            'slug'  => $t->slug,
            'count' => (int) $t->count,
        ];
    }

    return new WP_REST_Response($out, 200);
}

/**
 * GET /cidades?estado_id=XX | estado_slug=sp
 */
function turmas_rest_get_cidades(WP_REST_Request $request) {
    $estado_id   = $request->get_param('estado_id');
    $estado_slug = $request->get_param('estado_slug');

    if (!$estado_id && !$estado_slug) {
        return new WP_REST_Response([
            'error' => true,
            'message' => 'Informe estado_id ou estado_slug.',
        ], 400);
    }

    if (!$estado_id && $estado_slug) {
        $term = get_term_by('slug', sanitize_title($estado_slug), 'estado');
        if (!$term || is_wp_error($term)) {
            return new WP_REST_Response([
                'error' => true,
                'message' => 'Estado não encontrado pelo slug.',
            ], 404);
        }
        $estado_id = $term->term_id;
    }

    $estado_id = intval($estado_id);

    $posts = get_posts([
        'post_type'      => 'turma',
        'posts_per_page' => -1,
        'post_status'    => 'publish',
        'orderby'        => 'title',
        'order'          => 'ASC',
        'tax_query'      => [
            [
                'taxonomy' => 'estado',
                'field'    => 'term_id',
                'terms'    => [$estado_id],
            ],
        ],
    ]);

    $out = [];
    foreach ($posts as $p) {
        $out[] = [
            'id'    => (int) $p->ID,
            'title' => get_the_title($p->ID),
            'slug'  => $p->post_name,
        ];
    }

    return new WP_REST_Response($out, 200);
}

/**
 * GET /turmas?cidade_id=POST_ID
 */
function turmas_rest_get_turmas(WP_REST_Request $request) {
    $cidade_id = intval($request->get_param('cidade_id'));

    $post = get_post($cidade_id);
    if (!$post || $post->post_type !== 'turma' || $post->post_status !== 'publish') {
        return new WP_REST_Response([
            'error' => true,
            'message' => 'Cidade (turma) não encontrada.',
        ], 404);
    }

    // Metas que o plugin usa
    $final_semana = get_post_meta($cidade_id, '_turmas_pilates_turmas', true);
    $meio_semana  = get_post_meta($cidade_id, '_turmas_pilates_meio_semana', true);

    $info_fds        = get_post_meta($cidade_id, '_turmas_pilates_info_fds', true);
    $info_meio_semana = get_post_meta($cidade_id, '_turmas_pilates_info_meio_semana', true);

    // Garantir tipos consistentes (JSON previsível)
    if (!is_array($final_semana)) $final_semana = [];
    if (!is_array($meio_semana))  $meio_semana  = [];
    if (!is_string($info_fds)) $info_fds = '';
    if (!is_string($info_meio_semana)) $info_meio_semana = '';

    // Estado(s) vinculados à cidade
    $estados = wp_get_post_terms($cidade_id, 'estado', ['fields' => 'all']);
    $estados_out = [];
    if (!is_wp_error($estados)) {
        foreach ($estados as $t) {
            $estados_out[] = [
                'id'   => (int) $t->term_id,
                'name' => $t->name,
                'slug' => $t->slug,
            ];
        }
    }

    $payload = [
        'cidade' => [
            'id'    => (int) $cidade_id,
            'title' => get_the_title($cidade_id),
            'slug'  => $post->post_name,
            'estados' => $estados_out,
        ],
        'final_semana' => $final_semana,
        'meio_semana'  => $meio_semana,
        'info_adicional' => [
            'info_fds'         => $info_fds,
            'info_meio_semana' => $info_meio_semana,
        ],
    ];

    return new WP_REST_Response($payload, 200);
}
