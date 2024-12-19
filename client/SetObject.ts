import TDataBoot from "./types/TDataBoot";
import TAction from "./types/TAction";
import Socket from "./Socket";

export default class SetObject extends Socket {
    static async boot<T extends object>(
        data: TDataBoot<T>,
        action?: {
            get?: TAction<T>,
            set?: TAction<T>,
        },
    ) {
        const ws: WebSocket = this.create(data.id + '-' + (data.typeName ?? typeof data.instance));

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };

        await this.send_object_for_to_server(data, ws, action?.get);

        ws.onopen = () => {
            ws.send(JSON.stringify({
                data: {
                    instance: data.instance,
                },
                add_object: true,
            }));
        }

        return this.createProxy(data, ws, action?.set);
    }

    private static async send_object_for_to_server<T extends object>(
        data: TDataBoot<T>,
        ws: WebSocket,
        get?: TAction<T>
    ) {
        ws.onmessage = (event) => {
            const obj = JSON.parse(event.data);
            if('setObject' in obj) {
                //@ts-ignore
                Object.assign(data.instance, obj.setObject);
            } else if('key' in obj && 'value' in obj) {
                if(String(obj.key) in data.instance) {
                    //@ts-ignore
                    data.instance[String(obj.key)] = obj.value;

                    if(get) {
                        get({
                            ...data,
                            key: obj.key,
                            value: obj.value,
                        });
                    }
                }
            }
        };
    }

    private static async createProxy<T extends object>(
        data: TDataBoot<T>,
        ws: WebSocket,
        set?: TAction<T>
    ) {
        return new Proxy(data.instance, {
            set(_, key, value) {
                ws.send(JSON.stringify({
                    key: String(key),
                    value,
                }));

                if(set) {
                    set({
                        ...data,
                        key: String(key),
                        value,
                    })
                }

                return true;
            },
            get(_, key) {
                if(key in data.instance) {
                    //@ts-ignore
                    return data.instance[String(key)];
                }
                return undefined;
            }
        });
    }
}