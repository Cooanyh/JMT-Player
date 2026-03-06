from flask import Flask, jsonify, abort, send_from_directory
import os

# 初始化 Flask 应用
# static_url_path='/static' 表示静态文件URL以 /static 开头
# static_folder='static' 指向根目录下的 'static' 文件夹 (这是默认行为)
app = Flask(__name__, static_folder='static', static_url_path='/static')

# --- 配置广告文件目录 ---
# 假设 app.py 在项目根目录
# static/audio/ads/ 在项目根目录下的 static 文件夹内
ADS_AUDIO_PARENT_DIR = 'static'
ADS_SUB_DIR = 'audio/ads'
# app.root_path 是 app.py 文件所在目录的绝对路径
ADS_DIRECTORY = os.path.join(app.root_path, ADS_AUDIO_PARENT_DIR, ADS_SUB_DIR)


# --- API 接口：获取广告列表 ---
@app.route('/api/get-ad-list', methods=['GET'])
def get_ad_list():
    if not os.path.isdir(ADS_DIRECTORY):
        app.logger.error(f"广告目录未找到: {ADS_DIRECTORY}")
        return jsonify({"error": "服务器上未找到广告目录。", "path_checked": ADS_DIRECTORY}), 500

    ad_files_data = []
    try:
        for filename in os.listdir(ADS_DIRECTORY):
            file_path = os.path.join(ADS_DIRECTORY, filename)
            if os.path.isfile(file_path):
                if filename.lower().endswith(('.mp3', '.wav', '.ogg', '.m4a', '.aac')):
                    display_name = os.path.splitext(filename)[0].replace('_', ' ').strip()
                    if not display_name:
                        display_name = filename # Fallback to filename if display_name is empty
                    ad_files_data.append({'name': display_name, 'file': filename})
        return jsonify(ad_files_data)
    except Exception as e:
        app.logger.error(f"列出广告时发生错误: {e}")
        return jsonify({"error": "从目录列出广告失败。", "details": str(e)}), 500

# --- 路由：提供简洁版播放器 ---
@app.route('/')  # 根路径默认提供简洁版
@app.route('/simple')
def serve_simple_player_html():
    # 假设 simple_player.html 在 app.py 相同的目录下 (app.root_path)
    return send_from_directory(app.root_path, 'simple_player.html')

# --- 路由：提供功能版播放器 ---
@app.route('/functional')
def serve_functional_player_html():
    # 假设 functional_player.html 在 app.py 相同的目录下 (app.root_path)
    return send_from_directory(app.root_path, 'functional_player.html')

# --- 路由：从根目录提供其他文件 (例如 jmt.png) ---
# 此路由将捕获对根目录下文件的请求，例如 /jmt.png
@app.route('/<path:filename>')
def serve_root_file(filename):
    # 安全性：仅允许从根目录提供特定的预期文件。
    # 确保 'jmt.png' 确实在项目的根目录下 (与 app.py 同级)
    allowed_root_files = ['jmt.png'] # 如果有其他根目录文件需要提供，在此添加
    if filename in allowed_root_files:
        return send_from_directory(app.root_path, filename)
    else:
        # 如果请求的文件不在允许列表中，则返回 404 错误。
        return abort(404)

# --- 运行 Flask 应用 ---
if __name__ == '__main__':
    new_port = 5001 # 定义新的端口号
    print(f"广告音频文件目录 (由API读取): {ADS_DIRECTORY}")
    print(f"Flask 将从根目录提供 simple_player.html (通过 / 或 /simple )。")
    print(f"Flask 将从根目录提供 functional_player.html (通过 /functional )。")
    print(f"Flask 将从根目录提供 jmt.png (通过 /jmt.png )。")
    print(f"Flask 将从 './static' 目录提供静态资源 (例如广告音频通过 /static/audio/ads/... )。")
    print(f"请在浏览器中访问:")
    print(f"  简洁版: http://127.0.0.1:{new_port}/simple (或 http://127.0.0.1:{new_port}/)")
    print(f"  功能版: http://127.0.0.1:{new_port}/functional")

    if not os.path.isdir(ADS_DIRECTORY):
        print(f"警告: 广告目录 '{ADS_DIRECTORY}' 不存在。请创建该目录并放入音频文件。")
    
    # 确保 Flask 在开发时能从所有网络接口访问，如果需要的话
    # 对于生产环境，应使用生产级 WSGI 服务器如 Gunicorn 或 uWSGI
    app.run(debug=True, host='0.0.0.0', port=new_port) # 使用新的端口号
